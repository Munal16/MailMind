import re
from datetime import timedelta
from datetime import datetime

from django.utils import timezone

from ai.utils.text_preprocessing import normalize_text
from emails.gmail_service import GmailAuthError, get_gmail_service
from emails.parsing import collect_attachments


STOPWORDS = {
    "find",
    "emails",
    "email",
    "about",
    "the",
    "a",
    "an",
    "for",
    "with",
    "from",
    "to",
    "last",
    "this",
    "that",
    "show",
    "me",
    "related",
}

INTENT_HINTS = {
    "verification": "Verification",
    "code": "Verification",
    "otp": "Verification",
    "update": "Updates",
    "updates": "Updates",
    "status": "Updates",
    "newsletter": "Promotions",
    "promotion": "Promotions",
    "promotions": "Promotions",
    "offer": "Promotions",
    "discount": "Promotions",
    "social": "Social",
    "invite": "Social",
    "event": "Social",
    "spam": "Spam",
}


def _get_prediction(email):
    try:
        return email.prediction
    except Exception:
        return None


def _parse_query(query: str):
    text = normalize_text(query).lower()
    tokens = [token for token in re.findall(r"[a-z0-9#@._/-]+", text) if token not in STOPWORDS]

    wants_tasks = any(keyword in text for keyword in ["task", "tasks", "action", "todo", "follow up", "follow-up", "deadline"])
    wants_attachments = any(keyword in text for keyword in ["attachment", "attachments", "file", "files", "document", "pdf", "doc", "image"])

    intent = None
    for keyword, label in INTENT_HINTS.items():
        if keyword in text:
            intent = label
            break

    urgency = None
    if any(keyword in text for keyword in ["urgent", "asap", "immediately", "critical", "high priority"]):
        urgency = "High"
    elif any(keyword in text for keyword in ["medium priority", "normal priority"]):
        urgency = "Medium"
    elif any(keyword in text for keyword in ["low priority", "low urgency"]):
        urgency = "Low"

    now = timezone.now()
    date_from = None
    if "today" in text:
        date_from = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif "yesterday" in text:
        date_from = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    elif "last week" in text:
        date_from = now - timedelta(days=7)
    elif "this week" in text:
        date_from = now - timedelta(days=now.weekday())

    return {
        "raw": text,
        "tokens": tokens,
        "intent": intent,
        "urgency": urgency,
        "wants_tasks": wants_tasks,
        "wants_attachments": wants_attachments,
        "date_from": date_from,
    }


def _score_email(email, parsed):
    if parsed["date_from"] and email.internal_date and email.internal_date < parsed["date_from"]:
        return 0, []

    score = 0
    reasons = []

    subject = normalize_text(email.subject).lower()
    sender = normalize_text(email.sender).lower()
    snippet = normalize_text(email.snippet).lower()
    body = normalize_text(email.full_body_text).lower()
    project_name = normalize_text(getattr(email, "project_name", "")).lower()
    task_text = " ".join(normalize_text(task.task_text).lower() for task in email.tasks.all())

    haystacks = [
        (subject, 8, "subject"),
        (project_name, 7, "project"),
        (sender, 5, "sender"),
        (snippet, 4, "snippet"),
        (body, 3, "body"),
        (task_text, 6, "task"),
    ]

    if parsed["raw"] and parsed["raw"] in f"{subject} {sender} {snippet} {body} {project_name}":
        score += 10
        reasons.append("phrase")

    for token in parsed["tokens"]:
        for haystack, weight, reason in haystacks:
            if token and token in haystack:
                score += weight
                reasons.append(reason)
                break

    prediction = _get_prediction(email)
    if parsed["intent"] and prediction and prediction.intent == parsed["intent"]:
        score += 8
        reasons.append("intent")

    if parsed["urgency"] and prediction and prediction.urgency == parsed["urgency"]:
        score += 8
        reasons.append("urgency")

    if parsed["wants_tasks"] and email.tasks.exists():
        score += 5
        reasons.append("tasks")

    labels = email.labels or ""
    if parsed["wants_attachments"] and "HAS_ATTACHMENT" in labels:
        score += 5
        reasons.append("attachments")

    return score, reasons


def _serialize_email_result(email, score, reasons):
    prediction = _get_prediction(email)
    tasks = list(
        email.tasks.all().values(
            "id",
            "task_text",
            "confidence",
            "status",
            "deadline",
            "responsibility",
        )[:3]
    )
    return {
        "gmail_id": email.gmail_id,
        "sender": email.sender,
        "subject": email.subject,
        "snippet": email.snippet,
        "internal_date": email.internal_date.isoformat() if email.internal_date else None,
        "project_name": email.project_name,
        "prediction": (
            {
                "urgency": prediction.urgency,
                "intent": prediction.intent,
                "priority_score": prediction.priority_score,
            }
            if prediction
            else None
        ),
        "tasks": tasks,
        "match_score": score,
        "match_reasons": sorted(set(reasons)),
    }


def _collect_attachment_results(user, emails, parsed):
    attachments = []
    candidate_emails = [email for email in emails if "HAS_ATTACHMENT" in (email.labels or "")]

    if not candidate_emails:
        return attachments

    try:
        service = get_gmail_service(user)
    except GmailAuthError:
        return attachments
    for email in candidate_emails[:4]:
        try:
            msg = service.users().messages().get(userId="me", id=email.gmail_id, format="full").execute()
        except Exception:
            continue

        for attachment in collect_attachments(msg.get("payload", {})):
            search_blob = normalize_text(
                f"{attachment['filename']} {email.subject or ''} {email.sender or ''} {email.project_name or ''}"
            ).lower()
            if parsed["tokens"] and not any(token in search_blob for token in parsed["tokens"]) and not parsed["wants_attachments"]:
                continue

            attachments.append(
                {
                    "id": f"{email.gmail_id}-{attachment['attachment_id']}",
                    "gmail_id": email.gmail_id,
                    "attachment_id": attachment["attachment_id"],
                    "name": attachment["filename"],
                    "sender": email.sender,
                    "project_name": email.project_name,
                    "size": attachment["size"],
                    "mime_type": attachment["mime_type"],
                }
            )

    return attachments[:6]


def search_mail_context(user, queryset, query: str, limit: int = 8):
    parsed = _parse_query(query)
    scored = []

    for email in queryset:
        score, reasons = _score_email(email, parsed)
        if score > 0 or not parsed["tokens"]:
            scored.append((email, score, reasons))

    scored.sort(
        key=lambda item: (
            item[1],
            _get_prediction(item[0]).priority_score if _get_prediction(item[0]) else 0,
            item[0].internal_date or timezone.make_aware(datetime.min),
        ),
        reverse=True,
    )

    top_matches = scored[:limit]
    top_emails = [_serialize_email_result(email, score, reasons) for email, score, reasons in top_matches]

    task_results = []
    for email, score, reasons in top_matches:
        for task in email.tasks.all():
            task_text = normalize_text(task.task_text).lower()
            if parsed["tokens"] and not any(token in task_text for token in parsed["tokens"]) and not parsed["wants_tasks"]:
                continue
            task_results.append(
                {
                    "id": task.id,
                    "gmail_id": email.gmail_id,
                    "title": task.task_text,
                    "source": email.sender or email.subject,
                    "deadline": task.deadline,
                    "responsibility": task.responsibility,
                    "project_name": email.project_name,
                    "confidence": task.confidence,
                }
            )

    attachments = _collect_attachment_results(user, [item[0] for item in top_matches], parsed)

    return {
        "query": query,
        "matched_emails": top_emails,
        "related_attachments": attachments,
        "related_tasks": task_results[:8],
        "detected_context": {
            "intent": parsed["intent"],
            "urgency": parsed["urgency"],
            "wants_tasks": parsed["wants_tasks"],
            "wants_attachments": parsed["wants_attachments"],
            "date_from": parsed["date_from"].isoformat() if parsed["date_from"] else None,
        },
    }
