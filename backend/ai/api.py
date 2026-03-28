import re
from collections import Counter
from datetime import timedelta
from html import unescape

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ai.models import EmailPrediction, ExtractedTask
from ai.services.contextual_search import search_mail_context
from ai.services.priority import calculate_priority_score
from ai.services.task_inference import extract_tasks_from_email
from ai.services.urgency_inference import predict_urgency
from ai.utils.project_grouping import refresh_project_groups_for_user
from ai.utils.task_metadata import extract_deadline_hint, extract_responsibility_hint
from emails.models import EmailMessage

_predict_intent_fn = None
_intent_checked = False


def _get_predict_intent():
    global _predict_intent_fn, _intent_checked

    if _intent_checked:
        return _predict_intent_fn

    try:
        from ai.services.intent_inference import predict_intent

        _predict_intent_fn = predict_intent
    except Exception:
        _predict_intent_fn = None
    finally:
        _intent_checked = True

    return _predict_intent_fn


def _serialize_prediction(prediction):
    if not prediction:
        return None
    return {
        "urgency": prediction.urgency,
        "urgency_confidence": prediction.urgency_confidence,
        "intent": prediction.intent,
        "intent_confidence": prediction.intent_confidence,
        "priority_score": prediction.priority_score,
    }


def _serialize_task(task):
    return {
        "id": task.id,
        "task_text": task.task_text,
        "confidence": task.confidence,
        "status": task.status,
        "deadline": task.deadline,
        "responsibility": task.responsibility,
    }


def _clean_priority_text(value, max_length=160):
    text = unescape(str(value or ""))
    if not text:
        return ""

    text = re.sub(r"https?://\S+|www\.\S+", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\b[\w.-]{2,40}=[^\s,;]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip(" .,:;|-")
    text = re.sub(r"\s+([,.!?])", r"\1", text)

    if len(text) > max_length:
        trimmed = text[:max_length].rsplit(" ", 1)[0].strip()
        text = f"{trimmed or text[:max_length].strip()}..."

    return text.strip()


def _looks_like_noise(text):
    if not text:
        return True

    lowered = text.lower()
    blocked_phrases = [
        "read more",
        "view in browser",
        "unsubscribe",
        "shared a post",
        "network_conversations",
        "origin=",
        "utm_",
        "lipi=",
        "comment",
    ]
    if any(phrase in lowered for phrase in blocked_phrases):
        return True

    alpha_count = sum(char.isalpha() for char in text)
    if alpha_count < 10:
        return True

    if len(text.split()) < 3:
        return True

    return False


def _priority_task_signal(tasks):
    ordered_tasks = sorted(
        list(tasks),
        key=lambda task: ((task.confidence or 0), bool(task.deadline), bool(task.responsibility)),
        reverse=True,
    )

    for primary_task in ordered_tasks:
        task_text = _clean_priority_text(primary_task.task_text, max_length=132)
        deadline = _clean_priority_text(primary_task.deadline, max_length=80)
        responsibility = _clean_priority_text(primary_task.responsibility, max_length=80)

        if _looks_like_noise(task_text):
            continue

        return {
            "task_text": task_text,
            "deadline": deadline,
            "responsibility": responsibility,
        }

    return None


def _build_priority_reason(prediction, tasks):
    signal = _priority_task_signal(tasks)

    if signal:
        if signal["deadline"]:
            return f"Action needed: {signal['task_text']}. Timing cue: {signal['deadline']}."
        if signal["responsibility"]:
            return f"Action needed: {signal['task_text']}. Owner cue: {signal['responsibility']}."
        return f"Action needed: {signal['task_text']}."

    if prediction.urgency == "High" and prediction.intent:
        return f"Marked high urgency because the email matches {prediction.intent.lower()} intent signals."
    if prediction.urgency == "High":
        return "Marked high urgency by MailMind's urgency model."
    if prediction.urgency == "Medium" and prediction.intent:
        return f"Prioritized for follow-up because it matches {prediction.intent.lower()} intent patterns."
    if prediction.intent:
        return f"Priority comes from detected {prediction.intent.lower()} intent in the email content."
    if prediction.explanation:
        return prediction.explanation
    return "Priority calculated from urgency, intent, and extracted action signals."


def _analyze_single_email(user, email):
    body_text = email.full_body_text or email.snippet or ""
    urgency_result = predict_urgency(email.subject or "", body_text)

    intent_result = None
    predict_intent = _get_predict_intent()
    if predict_intent:
        try:
            intent_result = predict_intent(email.subject or "", body_text)
        except Exception:
            intent_result = None

    urgency = urgency_result.get("urgency")
    urgency_conf = urgency_result.get("confidence")

    intent = intent_result.get("intent") if intent_result else None
    intent_conf = intent_result.get("confidence") if intent_result else None

    priority_score = calculate_priority_score(urgency, intent)

    task_results = extract_tasks_from_email(body_text, threshold=0.50)
    ExtractedTask.objects.filter(user=user, email=email).delete()

    created_task_objects = []
    created_tasks = []
    body_deadline = extract_deadline_hint(body_text)
    body_owner = extract_responsibility_hint(body_text, sender=email.sender)

    for item in task_results:
        deadline = extract_deadline_hint(item["task_text"]) or body_deadline
        responsibility = (
            extract_responsibility_hint(item["task_text"], sender=email.sender)
            or body_owner
        )

        task = ExtractedTask.objects.create(
            user=user,
            email=email,
            task_text=item["task_text"],
            confidence=item["score"],
            deadline=deadline,
            responsibility=responsibility,
        )
        created_task_objects.append(task)
        created_tasks.append(_serialize_task(task))

    explanation = _build_priority_reason(
        type(
            "PredictionSignals",
            (),
            {
                "urgency": urgency,
                "intent": intent,
                "explanation": None,
            },
        )(),
        created_task_objects,
    )

    prediction, _ = EmailPrediction.objects.update_or_create(
        user=user,
        email=email,
        defaults={
            "urgency": urgency,
            "urgency_confidence": urgency_conf,
            "intent": intent,
            "intent_confidence": intent_conf,
            "priority_score": priority_score,
            "explanation": explanation,
        },
    )

    return prediction, created_tasks


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def analyze_email(request, gmail_id):
    email = EmailMessage.objects.filter(user=request.user, gmail_id=gmail_id).first()
    if not email:
        return Response({"error": "Email not found"}, status=404)

    prediction, created_tasks = _analyze_single_email(request.user, email)
    refresh_project_groups_for_user(request.user)
    email.refresh_from_db(fields=["project_name"])

    return Response(
        {
            "gmail_id": gmail_id,
            "project_name": email.project_name,
            "prediction": _serialize_prediction(prediction),
            "tasks": created_tasks,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def analyze_latest_emails(request):
    limit = int(request.data.get("limit", 20))

    emails = (
        EmailMessage.objects.filter(user=request.user)
        .order_by("-internal_date", "-created_at")[:limit]
    )

    analyzed = 0
    for email in emails:
        _analyze_single_email(request.user, email)
        analyzed += 1

    refresh_project_groups_for_user(request.user)

    return Response({"analyzed": analyzed})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_tasks(request):
    tasks = (
        ExtractedTask.objects.filter(user=request.user)
        .select_related("email")
        .order_by("-created_at")
    )

    data = []
    for task in tasks:
        data.append(
            {
                "id": task.id,
                "gmail_id": task.email.gmail_id,
                "task_text": task.task_text,
                "confidence": task.confidence,
                "status": task.status,
                "deadline": task.deadline,
                "responsibility": task.responsibility,
                "project_name": task.email.project_name,
                "email_subject": task.email.subject,
                "email_sender": task.email.sender,
            }
        )

    return Response({"tasks": data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def priority_emails(request):
    predictions = (
        EmailPrediction.objects.filter(user=request.user)
        .select_related("email")
        .prefetch_related("email__tasks")
        .order_by("-priority_score", "-created_at")
    )

    emails = []
    for prediction in predictions:
        email = prediction.email
        task_queryset = list(email.tasks.all())
        task_signal = _priority_task_signal(task_queryset)
        deadline = (
            email.tasks.exclude(deadline__isnull=True)
            .exclude(deadline__exact="")
            .values_list("deadline", flat=True)
            .first()
        )
        emails.append(
            {
                "gmail_id": email.gmail_id,
                "sender": email.sender,
                "subject": email.subject,
                "project_name": email.project_name,
                "urgency": prediction.urgency,
                "urgency_confidence": prediction.urgency_confidence,
                "intent": prediction.intent,
                "intent_confidence": prediction.intent_confidence,
                "priority_score": prediction.priority_score,
                "deadline": deadline,
                "reason": _build_priority_reason(prediction, task_queryset),
                "task_preview": task_signal["task_text"] if task_signal else "",
                "task_support": (task_signal["deadline"] or task_signal["responsibility"]) if task_signal else "",
                "tasks": [
                    {
                        **_serialize_task(task),
                        "task_text": _clean_priority_text(task.task_text, max_length=132),
                    }
                    for task in task_queryset[:3]
                    if not _looks_like_noise(_clean_priority_text(task.task_text, max_length=132))
                ],
                "task_count": len(task_queryset),
                "internal_date": email.internal_date.isoformat() if email.internal_date else None,
            }
        )

    return Response({"emails": emails})


def _weekday_activity(emails):
    order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    counts = {name: 0 for name in order}
    for email in emails:
        if email.internal_date:
            counts[email.internal_date.strftime("%a")] += 1
    return [{"name": name, "emails": counts[name]} for name in order]


def _weekly_urgency_trend(predictions):
    now = timezone.now()
    start_of_week = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    buckets = []
    for index in range(3, -1, -1):
        week_start = start_of_week - timedelta(weeks=index)
        week_end = week_start + timedelta(days=7)
        bucket_preds = [
            pred
            for pred in predictions
            if (pred.email.internal_date or pred.created_at) and week_start <= (pred.email.internal_date or pred.created_at) < week_end
        ]
        urgency_counter = Counter(pred.urgency for pred in bucket_preds if pred.urgency)
        buckets.append(
            {
                "name": f"W{4 - index}",
                "high": urgency_counter.get("High", 0),
                "medium": urgency_counter.get("Medium", 0),
                "low": urgency_counter.get("Low", 0),
            }
        )
    return buckets


def _active_contacts(emails):
    counts = Counter(email.sender for email in emails if email.sender)
    results = []
    for sender, count in counts.most_common(5):
        initials = "".join(part[0] for part in sender.split()[:2]).upper() or "MM"
        results.append(
            {
                "name": sender,
                "count": count,
                "initials": initials[:2],
            }
        )
    return results


def _top_projects(emails):
    counts = Counter(email.project_name for email in emails if email.project_name)
    return [{"name": name, "count": count} for name, count in counts.most_common(5)]


def _task_status_distribution(tasks):
    counts = Counter(task.status for task in tasks if task.status)
    return dict(counts)


def _recent_insights(urgency_counts, intent_counts, tasks, emails):
    insights = []
    total_urgent = urgency_counts.get("High", 0)
    if total_urgent:
        insights.append(
            {
                "title": "Urgency load detected",
                "description": f"{total_urgent} emails are marked high urgency and should be triaged first.",
            }
        )

    if intent_counts:
        top_intent, top_count = intent_counts.most_common(1)[0]
        insights.append(
            {
                "title": "Dominant intent class",
                "description": f"{top_intent} is the most common intent across analyzed emails ({top_count} messages).",
            }
        )

    deadline_count = sum(1 for task in tasks if task.deadline)
    if deadline_count:
        insights.append(
            {
                "title": "Deadline cues extracted",
                "description": f"{deadline_count} tasks include deadline hints captured from email content.",
            }
        )

    project_count = len({email.project_name for email in emails if email.project_name})
    if project_count:
        insights.append(
            {
                "title": "Project-based grouping active",
                "description": f"MailMind has grouped the inbox into {project_count} active project threads.",
            }
        )

    return insights[:4]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ai_summary(request):
    predictions = list(
        EmailPrediction.objects.filter(user=request.user).select_related("email").order_by("-created_at")
    )
    emails = list(
        EmailMessage.objects.filter(user=request.user).select_related("prediction").order_by("-internal_date", "-created_at")
    )
    tasks = list(
        ExtractedTask.objects.filter(user=request.user).select_related("email").order_by("-created_at")
    )

    urgency_counts = Counter(pred.urgency for pred in predictions if pred.urgency)
    intent_counts = Counter(pred.intent for pred in predictions if pred.intent)

    return Response(
        {
            "total_predictions": len(predictions),
            "total_emails": len(emails),
            "attachments_received": sum(1 for email in emails if "HAS_ATTACHMENT" in (email.labels or "")),
            "project_count": len({email.project_name for email in emails if email.project_name}),
            "urgency_distribution": dict(urgency_counts),
            "intent_distribution": dict(intent_counts),
            "pending_tasks": sum(1 for task in tasks if task.status == "Pending"),
            "total_tasks": len(tasks),
            "task_status_distribution": _task_status_distribution(tasks),
            "tasks_with_deadline": sum(1 for task in tasks if task.deadline),
            "activity_timeline": _weekday_activity(emails),
            "weekly_urgency_trend": _weekly_urgency_trend(predictions),
            "most_active_contacts": _active_contacts(emails),
            "top_projects": _top_projects(emails),
            "recent_insights": _recent_insights(urgency_counts, intent_counts, tasks, emails),
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def contextual_search(request):
    query = request.GET.get("q", "").strip()
    if not query:
        return Response(
            {
                "query": "",
                "matched_emails": [],
                "related_attachments": [],
                "related_tasks": [],
                "detected_context": {},
            }
        )

    queryset = (
        EmailMessage.objects.filter(user=request.user)
        .select_related("prediction")
        .prefetch_related("tasks")
        .order_by("-internal_date", "-created_at")[:300]
    )
    return Response(search_mail_context(request.user, queryset, query))
