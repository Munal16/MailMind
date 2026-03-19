from datetime import datetime, timezone

from django.db import IntegrityError
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ai.utils.project_grouping import infer_project_name
from .gmail_service import GmailAuthError, get_gmail_service
from .models import EmailMessage, GmailCredential
from .parsing import extract_body_text


def _serialize_prediction(prediction):
    if not prediction:
        return None
    return {
        "urgency": prediction.urgency,
        "urgency_confidence": prediction.urgency_confidence,
        "intent": prediction.intent,
        "intent_confidence": prediction.intent_confidence,
        "priority_score": prediction.priority_score,
        "explanation": prediction.explanation,
    }


def _get_prediction(email):
    try:
        return email.prediction
    except Exception:
        return None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def gmail_status(request):
    connected = GmailCredential.objects.filter(user=request.user, refresh_token__isnull=False).exists()
    return Response({"connected": connected})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def gmail_sync(request):
    max_results = int(request.data.get("max_results", 20))

    try:
        service = get_gmail_service(request.user)
    except GmailAuthError as exc:
        return Response({"error": str(exc), "requires_reconnect": True}, status=400)

    response = service.users().messages().list(
        userId="me",
        labelIds=["INBOX"],
        maxResults=max_results,
    ).execute()

    messages = response.get("messages", [])
    saved = 0
    skipped = 0
    updated = 0

    for item in messages:
        gmail_id = item.get("id")
        if not gmail_id:
            continue

        message = service.users().messages().get(userId="me", id=gmail_id, format="full").execute()
        payload = message.get("payload", {})
        headers = payload.get("headers", [])
        label_ids = message.get("labelIds", [])

        subject = next((header.get("value") for header in headers if (header.get("name") or "").lower() == "subject"), None)
        sender = next((header.get("value") for header in headers if (header.get("name") or "").lower() == "from"), None)
        snippet = message.get("snippet")
        full_body_text = extract_body_text(payload) or snippet or ""
        project_name = infer_project_name(subject or "", full_body_text)

        internal_ms = message.get("internalDate")
        internal_dt = None
        if internal_ms:
            internal_dt = datetime.fromtimestamp(int(internal_ms) / 1000, tz=timezone.utc)

        defaults = {
            "thread_id": message.get("threadId"),
            "subject": subject,
            "sender": sender,
            "snippet": snippet,
            "full_body_text": full_body_text,
            "project_name": project_name,
            "internal_date": internal_dt,
            "labels": ",".join(label_ids) if label_ids else "",
            "is_read": "UNREAD" not in label_ids,
            "is_starred": "STARRED" in label_ids,
        }

        try:
            _, created = EmailMessage.objects.update_or_create(
                user=request.user,
                gmail_id=gmail_id,
                defaults=defaults,
            )
            if created:
                saved += 1
            else:
                updated += 1
        except IntegrityError:
            skipped += 1

    return Response(
        {
            "requested": max_results,
            "saved": saved,
            "updated": updated,
            "skipped": skipped,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def gmail_inbox(request):
    limit = int(request.GET.get("limit", 50))
    queryset = (
        EmailMessage.objects.filter(user=request.user)
        .select_related("prediction")
        .prefetch_related("tasks")
        .order_by("-internal_date", "-created_at")[:limit]
    )

    emails = []
    for email in queryset:
        emails.append(
            {
                "gmail_id": email.gmail_id,
                "thread_id": email.thread_id,
                "subject": email.subject,
                "sender": email.sender,
                "snippet": email.snippet,
                "full_body_text": email.full_body_text,
                "project_name": email.project_name,
                "internal_date": email.internal_date.isoformat() if email.internal_date else None,
                "labels": email.labels.split(",") if email.labels else [],
                "is_read": email.is_read,
                "is_starred": email.is_starred,
                "prediction": _serialize_prediction(_get_prediction(email)),
                "tasks": list(
                    email.tasks.all().values(
                        "id",
                        "task_text",
                        "confidence",
                        "status",
                        "deadline",
                        "responsibility",
                    )
                ),
            }
        )

    return Response({"count": len(emails), "emails": emails})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def gmail_detail(request, gmail_id):
    email = EmailMessage.objects.filter(user=request.user, gmail_id=gmail_id).first()
    if not email:
        return Response({"error": "Email not found in DB. Sync first."}, status=404)

    try:
        service = get_gmail_service(request.user)
    except GmailAuthError as exc:
        return Response({"error": str(exc), "requires_reconnect": True}, status=400)

    message = service.users().messages().get(userId="me", id=gmail_id, format="full").execute()
    body = extract_body_text(message.get("payload", {})) or email.full_body_text or email.snippet or ""
    project_name = infer_project_name(email.subject or "", body)

    fields_to_update = []
    if body and body != email.full_body_text:
        email.full_body_text = body
        fields_to_update.append("full_body_text")
    if project_name and project_name != email.project_name:
        email.project_name = project_name
        fields_to_update.append("project_name")
    if fields_to_update:
        email.save(update_fields=fields_to_update)

    return Response(
        {
            "gmail_id": email.gmail_id,
            "thread_id": email.thread_id,
            "subject": email.subject,
            "sender": email.sender,
            "project_name": email.project_name,
            "internal_date": email.internal_date.isoformat() if email.internal_date else None,
            "is_read": email.is_read,
            "labels": email.labels.split(",") if email.labels else [],
            "body": body,
            "snippet": email.snippet,
        }
    )


SMART_VIEW_ALIASES = {
    "priority": {"urgency": "High"},
    "verification": {"intent": "Verification"},
    "updates": {"intent": "Updates"},
    "promotions": {"intent": "Promotions"},
    "social": {"intent": "Social"},
    "spam": {"intent": "Spam"},
    "general": {"intent": "General"},
    # Legacy aliases kept compatible with older UI flows.
    "meetings": {"intent": "Updates"},
    "payments": {"intent": "Updates"},
    "support": {"intent": "Verification"},
    "deliveries": {"intent": "Updates"},
}


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def smart_view(request, view_type):
    filters = SMART_VIEW_ALIASES.get(view_type.lower(), {})

    queryset = (
        EmailMessage.objects.filter(user=request.user)
        .select_related("prediction")
        .prefetch_related("tasks")
        .order_by("-prediction__priority_score", "-internal_date")[:50]
    )

    if filters.get("urgency"):
        queryset = queryset.filter(prediction__urgency=filters["urgency"])
    if filters.get("intent"):
        queryset = queryset.filter(prediction__intent=filters["intent"])

    emails = []
    for email in queryset:
        emails.append(
            {
                "gmail_id": email.gmail_id,
                "subject": email.subject,
                "sender": email.sender,
                "snippet": email.snippet,
                "project_name": email.project_name,
                "internal_date": email.internal_date.isoformat() if email.internal_date else None,
                "prediction": _serialize_prediction(_get_prediction(email)),
                "tasks": list(
                    email.tasks.all().values(
                        "id",
                        "task_text",
                        "confidence",
                        "status",
                        "deadline",
                        "responsibility",
                    )
                ),
            }
        )

    return Response({"emails": emails})
