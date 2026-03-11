import base64
import binascii
from datetime import datetime, timezone

from django.db import IntegrityError
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .gmail_service import get_gmail_service
from .models import GmailCredential, EmailMessage


def _get_header(headers, name):
    name = name.lower()
    for h in headers or []:
        if (h.get("name") or "").lower() == name:
            return h.get("value")
    return None


def _decode_b64url(data: str) -> str:
    if not data:
        return ""
    padding = "=" * (-len(data) % 4)
    try:
        raw = base64.urlsafe_b64decode(data + padding)
        return raw.decode("utf-8", errors="replace")
    except (binascii.Error, ValueError):
        return ""


def _extract_body_text(payload: dict) -> str:
    if not payload:
        return ""

    mime_type = payload.get("mimeType", "")
    body_data = (payload.get("body") or {}).get("data")
    parts = payload.get("parts") or []

    if mime_type == "text/plain" and body_data:
        return _decode_b64url(body_data)

    if mime_type == "text/html" and body_data:
        return _decode_b64url(body_data)

    for part in parts:
        text = _extract_body_text(part)
        if text:
            return text

    if body_data:
        return _decode_b64url(body_data)

    return ""


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def gmail_status(request):
    connected = GmailCredential.objects.filter(user=request.user, refresh_token__isnull=False).exists()
    return Response({"connected": connected})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def gmail_sync(request):
    """
    Pull latest N emails from Gmail and store in Postgres.
    Body: { "max_results": 20 }  (optional)
    """
    max_results = int(request.data.get("max_results", 20))

    service = get_gmail_service(request.user)

    # List messages from inbox
    resp = service.users().messages().list(
        userId="me",
        labelIds=["INBOX"],
        maxResults=max_results,
    ).execute()

    messages = resp.get("messages", [])
    saved = 0
    skipped = 0

    for m in messages:
        msg_id = m.get("id")
        if not msg_id:
            continue

        # Fetch minimal metadata
        msg = service.users().messages().get(
            userId="me",
            id=msg_id,
            format="metadata",
            metadataHeaders=["Subject", "From", "Date"],
        ).execute()

        payload = msg.get("payload", {})
        headers = payload.get("headers", [])
        subject = _get_header(headers, "Subject")
        sender = _get_header(headers, "From")
        snippet = msg.get("snippet")
        thread_id = msg.get("threadId")
        label_ids = msg.get("labelIds", [])

        # internalDate is ms since epoch
        internal_ms = msg.get("internalDate")
        internal_dt = None
        if internal_ms:
            internal_dt = datetime.fromtimestamp(int(internal_ms) / 1000, tz=timezone.utc)

        is_read = "UNREAD" not in label_ids
        is_starred = "STARRED" in label_ids

        try:
            EmailMessage.objects.create(
                user=request.user,
                gmail_id=msg_id,
                thread_id=thread_id,
                subject=subject,
                sender=sender,
                snippet=snippet,
                internal_date=internal_dt,
                labels=",".join(label_ids) if label_ids else "",
                is_read=is_read,
                is_starred=is_starred,
            )
            saved += 1
        except IntegrityError:
            skipped += 1

    return Response({"requested": max_results, "saved": saved, "skipped": skipped})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def gmail_inbox(request):
    """
    Returns emails stored in DB (latest first).
    Query: ?limit=50
    """
    limit = int(request.GET.get("limit", 50))
    qs = EmailMessage.objects.filter(user=request.user).order_by("-internal_date", "-created_at")[:limit]

    data = []
    for e in qs:
        pred = getattr(e, "prediction", None)

        data.append(
            {
                "gmail_id": e.gmail_id,
                "thread_id": e.thread_id,
                "subject": e.subject,
                "sender": e.sender,
                "snippet": e.snippet,
                "internal_date": e.internal_date.isoformat() if e.internal_date else None,
                "labels": e.labels.split(",") if e.labels else [],
                "is_read": e.is_read,
                "is_starred": e.is_starred,
                "prediction": (
                    {
                        "urgency": pred.urgency,
                        "intent": pred.intent,
                        "priority_score": pred.priority_score,
                        "explanation": pred.explanation,
                    }
                    if pred
                    else None
                ),
            }
        )

    return Response({"count": len(data), "emails": data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def gmail_detail(request, gmail_id):
    """
    Fetch full message body from Gmail API for an email already stored in DB.
    """
    email = EmailMessage.objects.filter(user=request.user, gmail_id=gmail_id).first()
    if not email:
        return Response({"error": "Email not found in DB. Sync first."}, status=404)

    service = get_gmail_service(request.user)
    msg = service.users().messages().get(userId="me", id=gmail_id, format="full").execute()
    body = _extract_body_text(msg.get("payload", {})) or email.snippet or ""

    return Response(
        {
            "gmail_id": email.gmail_id,
            "thread_id": email.thread_id,
            "subject": email.subject,
            "sender": email.sender,
            "internal_date": email.internal_date.isoformat() if email.internal_date else None,
            "is_read": email.is_read,
            "labels": email.labels.split(",") if email.labels else [],
            "body": body,
            "snippet": email.snippet,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def smart_view(request, view_type):
    """
    Smart inbox categories based on AI predictions.
    """
    user = request.user

    qs = EmailMessage.objects.filter(user=user)

    if view_type == "priority":
        qs = qs.filter(prediction__urgency="High")
    elif view_type == "meetings":
        qs = qs.filter(prediction__intent="Meeting")
    elif view_type == "payments":
        qs = qs.filter(prediction__intent="Payment")
    elif view_type == "support":
        qs = qs.filter(prediction__intent="Support")
    elif view_type == "deliveries":
        qs = qs.filter(prediction__intent="Delivery")

    qs = qs.order_by("-prediction__priority_score", "-internal_date")[:50]

    data = []
    for e in qs:
        pred = getattr(e, "prediction", None)
        data.append(
            {
                "gmail_id": e.gmail_id,
                "subject": e.subject,
                "sender": e.sender,
                "snippet": e.snippet,
                "internal_date": e.internal_date.isoformat() if e.internal_date else None,
                "prediction": (
                    {
                        "urgency": pred.urgency,
                        "intent": pred.intent,
                        "priority_score": pred.priority_score,
                    }
                    if pred
                    else None
                ),
            }
        )

    return Response({"emails": data})
