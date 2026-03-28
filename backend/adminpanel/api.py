from collections import defaultdict
from datetime import timedelta

from django.contrib.auth.models import User
from django.db import connection
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from ai.models import EmailPrediction, ExtractedTask
from emails.models import EmailMessage, GmailCredential
from mailmind.settings import BASE_DIR


def _safe_sender(value):
    raw = str(value or "").strip()
    return raw[:90] if raw else "Unknown sender"


def _model_status():
    model_checks = [
        {
            "id": "urgency",
            "label": "Urgency model",
            "path": BASE_DIR / "ml_models" / "urgency_linearsvc.joblib",
            "details": "Linear SVC pipeline used for urgency scoring.",
        },
        {
            "id": "task",
            "label": "Task extraction model",
            "path": BASE_DIR / "ml_models" / "task_sentence_classifier.joblib",
            "details": "Sentence classifier used to detect action items from email text.",
        },
        {
            "id": "intent",
            "label": "Intent model",
            "path": BASE_DIR / "ml_models" / "mailmind_intent_distilbert",
            "details": "Fine-tuned DistilBERT model used for current intent taxonomy.",
        },
    ]

    items = []
    for item in model_checks:
        exists = item["path"].exists()
        items.append(
            {
                "id": item["id"],
                "label": item["label"],
                "status": "Ready" if exists else "Missing",
                "details": item["details"],
                "path": str(item["path"].relative_to(BASE_DIR)) if exists else str(item["path"].name),
            }
        )
    return items


def _service_status(total_users, connected_users):
    database_status = "Healthy"
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        database_status = "Check required"

    return [
        {
            "id": "database",
            "label": "Database",
            "status": database_status,
            "details": "Primary PostgreSQL connection used for user, inbox, and AI records.",
        },
        {
            "id": "gmail",
            "label": "Gmail integration",
            "status": "Active" if connected_users else "Needs attention",
            "details": f"{connected_users} of {total_users} users currently have a connected Gmail inbox.",
        },
        {
            "id": "search",
            "label": "AI search",
            "status": "Ready",
            "details": "Global contextual search is available across emails, tasks, attachments, and app destinations.",
        },
        {
            "id": "notifications",
            "label": "Notification engine",
            "status": "Ready",
            "details": "Live notifications are derived from current inbox, task, and Gmail connection data.",
        },
    ]


def _build_daily_activity():
    today = timezone.localdate()
    buckets = []
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        buckets.append(
            {
                "date": day.isoformat(),
                "label": day.strftime("%a"),
                "signups": 0,
                "connections": 0,
                "syncs": 0,
                "analyses": 0,
            }
        )

    lookup = {bucket["date"]: bucket for bucket in buckets}

    for user in User.objects.filter(date_joined__date__gte=today - timedelta(days=6)):
        key = timezone.localtime(user.date_joined).date().isoformat()
        if key in lookup:
            lookup[key]["signups"] += 1

    for credential in GmailCredential.objects.filter(updated_at__date__gte=today - timedelta(days=6)):
        key = timezone.localtime(credential.updated_at).date().isoformat()
        if key in lookup:
            lookup[key]["connections"] += 1

    for email in EmailMessage.objects.filter(created_at__date__gte=today - timedelta(days=6)):
        key = timezone.localtime(email.created_at).date().isoformat()
        if key in lookup:
            lookup[key]["syncs"] += 1

    for prediction in EmailPrediction.objects.filter(created_at__date__gte=today - timedelta(days=6)):
        key = timezone.localtime(prediction.created_at).date().isoformat()
        if key in lookup:
            lookup[key]["analyses"] += 1

    return buckets


def _recent_users():
    rows = []
    for user in User.objects.order_by("-date_joined")[:8]:
        gmail_connected = GmailCredential.objects.filter(user=user, refresh_token__isnull=False).exists()
        rows.append(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "joined_at": timezone.localtime(user.date_joined).isoformat(),
                "is_staff": user.is_staff,
                "gmail_connected": gmail_connected,
            }
        )
    return rows


def _admin_directory(request_user):
    rows = []
    gmail_lookup = {
        user_id: True
        for user_id in GmailCredential.objects.filter(refresh_token__isnull=False).values_list("user_id", flat=True)
    }
    email_counts = defaultdict(int)
    task_counts = defaultdict(int)

    for user_id in EmailMessage.objects.values_list("user_id", flat=True):
        email_counts[user_id] += 1

    for user_id in ExtractedTask.objects.values_list("user_id", flat=True):
        task_counts[user_id] += 1

    for user in User.objects.order_by("is_staff", "is_superuser", "username"):
        rows.append(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "joined_at": timezone.localtime(user.date_joined).isoformat(),
                "last_login": timezone.localtime(user.last_login).isoformat() if user.last_login else None,
                "gmail_connected": bool(gmail_lookup.get(user.id)),
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
                "is_current_user": user.id == request_user.id,
                "mail_count": email_counts.get(user.id, 0),
                "task_count": task_counts.get(user.id, 0),
                "can_manage_admin_access": not user.is_superuser and user.id != request_user.id,
            }
        )
    return rows


def _recent_activity():
    events = []

    for user in User.objects.order_by("-date_joined")[:6]:
        events.append(
            {
                "kind": "signup",
                "title": f"New user account: {user.username}",
                "description": f"{user.email or 'No email set'} joined MailMind.",
                "timestamp": timezone.localtime(user.date_joined),
            }
        )

    for credential in GmailCredential.objects.filter(refresh_token__isnull=False).order_by("-updated_at")[:6]:
        events.append(
            {
                "kind": "gmail",
                "title": f"Gmail connected for {credential.user.username}",
                "description": "Gmail OAuth credentials are active for inbox sync.",
                "timestamp": timezone.localtime(credential.updated_at),
            }
        )

    for email in EmailMessage.objects.order_by("-created_at")[:8]:
        events.append(
            {
                "kind": "sync",
                "title": f"Email synced from {_safe_sender(email.sender)}",
                "description": email.subject or "(no subject)",
                "timestamp": timezone.localtime(email.created_at),
            }
        )

    for prediction in EmailPrediction.objects.select_related("email").order_by("-created_at")[:8]:
        events.append(
            {
                "kind": "analysis",
                "title": f"AI analyzed {prediction.email.subject or '(no subject)'}",
                "description": f"Urgency: {prediction.urgency or 'Unknown'} · Intent: {prediction.intent or 'Unknown'}",
                "timestamp": timezone.localtime(prediction.created_at),
            }
        )

    events.sort(key=lambda item: item["timestamp"], reverse=True)
    return [
        {
            **item,
            "timestamp": item["timestamp"].isoformat(),
        }
        for item in events[:10]
    ]


def _alerts(total_users, connected_users, total_emails, total_predictions, deadline_tasks, urgent_queue):
    alerts = []

    users_without_gmail = max(total_users - connected_users, 0)
    if users_without_gmail:
        alerts.append(
            {
                "title": "Users waiting for Gmail connection",
                "value": users_without_gmail,
                "details": "These accounts cannot sync inbox data until Gmail is connected.",
            }
        )

    if total_emails > total_predictions:
        alerts.append(
            {
                "title": "Emails still missing AI predictions",
                "value": total_emails - total_predictions,
                "details": "Run AI analysis to keep urgency, intent, and task data current.",
            }
        )

    if deadline_tasks:
        alerts.append(
            {
                "title": "Tasks with deadline cues",
                "value": deadline_tasks,
                "details": "Admin review can help monitor time-sensitive extracted actions.",
            }
        )

    if urgent_queue:
        alerts.append(
            {
                "title": "High-urgency queue",
                "value": urgent_queue,
                "details": "High-urgency emails are waiting across connected inboxes.",
            }
        )

    return alerts[:4]


@api_view(["GET"])
@permission_classes([IsAdminUser])
def overview(request):
    total_users = User.objects.count()
    admin_users = User.objects.filter(is_staff=True).count()
    connected_users = GmailCredential.objects.filter(refresh_token__isnull=False).count()
    total_emails = EmailMessage.objects.count()
    total_predictions = EmailPrediction.objects.count()
    total_tasks = ExtractedTask.objects.count()
    attachments_detected = EmailMessage.objects.filter(labels__icontains="HAS_ATTACHMENT").count()
    pending_tasks = ExtractedTask.objects.filter(status="Pending").count()
    deadline_tasks = ExtractedTask.objects.exclude(deadline__isnull=True).exclude(deadline="").count()
    urgent_queue = EmailPrediction.objects.filter(urgency="High").count()

    return Response(
        {
            "summary": {
                "total_users": total_users,
                "admin_users": admin_users,
                "gmail_connected_users": connected_users,
                "total_emails": total_emails,
                "total_predictions": total_predictions,
                "total_tasks": total_tasks,
                "attachments_detected": attachments_detected,
                "pending_tasks": pending_tasks,
                "deadline_tasks": deadline_tasks,
                "urgent_queue": urgent_queue,
            },
            "deployment_health": {
                "gmail_connection_rate": round((connected_users / total_users) * 100, 1) if total_users else 0,
                "analysis_coverage": round((total_predictions / total_emails) * 100, 1) if total_emails else 0,
                "task_coverage": round((total_tasks / total_predictions) * 100, 1) if total_predictions else 0,
            },
            "models": _model_status(),
            "services": _service_status(total_users, connected_users),
            "daily_activity": _build_daily_activity(),
            "recent_users": _recent_users(),
            "user_directory": _admin_directory(request.user),
            "recent_activity": _recent_activity(),
            "alerts": _alerts(total_users, connected_users, total_emails, total_predictions, deadline_tasks, urgent_queue),
        }
    )


@api_view(["POST"])
@permission_classes([IsAdminUser])
def set_admin_access(request, user_id):
    target = User.objects.filter(pk=user_id).first()
    if not target:
        return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    if target.id == request.user.id:
        return Response({"error": "Use another admin account to change your own admin access."}, status=status.HTTP_400_BAD_REQUEST)

    if target.is_superuser:
        return Response({"error": "System owner accounts cannot be changed from this panel."}, status=status.HTTP_400_BAD_REQUEST)

    value = request.data.get("is_staff")
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "on"}:
            value = True
        elif normalized in {"false", "0", "no", "off"}:
            value = False

    if not isinstance(value, bool):
        return Response({"error": "A valid admin access value is required."}, status=status.HTTP_400_BAD_REQUEST)

    target.is_staff = value
    target.save(update_fields=["is_staff"])

    return Response(
        {
            "message": "Admin access granted successfully." if value else "Admin access removed successfully.",
            "user": {
                "id": target.id,
                "username": target.username,
                "email": target.email,
                "is_staff": target.is_staff,
                "is_superuser": target.is_superuser,
            },
        }
    )
