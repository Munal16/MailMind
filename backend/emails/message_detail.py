import base64
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .gmail_service import get_gmail_service
from .models import EmailMessage


def _b64url_decode(data: str) -> str:
    if not data:
        return ""
    # Gmail uses base64url
    decoded = base64.urlsafe_b64decode(data.encode("utf-8"))
    return decoded.decode("utf-8", errors="replace")


def _find_part(payload: dict, mime_type: str):
    """
    Recursively find the first part of a given mime_type.
    """
    if not payload:
        return None

    if payload.get("mimeType") == mime_type and payload.get("body", {}).get("data"):
        return payload

    for part in payload.get("parts", []) or []:
        found = _find_part(part, mime_type)
        if found:
            return found

    return None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def gmail_message_detail(request, gmail_id):
    # Ensure email exists in our DB (ownership)
    email = EmailMessage.objects.filter(user=request.user, gmail_id=gmail_id).first()
    if not email:
        return Response({"error": "Email not found in DB. Sync first."}, status=404)

    service = get_gmail_service(request.user)

    msg = service.users().messages().get(
        userId="me",
        id=gmail_id,
        format="full",
    ).execute()

    payload = msg.get("payload", {})
    headers = payload.get("headers", [])

    def header(name):
        name = name.lower()
        for h in headers:
            if (h.get("name") or "").lower() == name:
                return h.get("value")
        return None

    subject = header("Subject")
    sender = header("From")
    to = header("To")
    date = header("Date")

    # Prefer plain text body first
    text_part = _find_part(payload, "text/plain")
    html_part = _find_part(payload, "text/html")

    body_text = ""
    body_html = ""

    if text_part:
        body_text = _b64url_decode(text_part.get("body", {}).get("data", ""))
    elif payload.get("mimeType") == "text/plain" and payload.get("body", {}).get("data"):
        body_text = _b64url_decode(payload.get("body", {}).get("data", ""))

    if html_part:
        body_html = _b64url_decode(html_part.get("body", {}).get("data", ""))
    elif payload.get("mimeType") == "text/html" and payload.get("body", {}).get("data"):
        body_html = _b64url_decode(payload.get("body", {}).get("data", ""))

    # Simple attachment list (metadata only for now)
    attachments = []

    def collect_attachments(part):
        if not part:
            return
        filename = part.get("filename")
        body = part.get("body", {})
        attachment_id = body.get("attachmentId")
        mime = part.get("mimeType")
        size = body.get("size")

        if filename and attachment_id:
            attachments.append(
                {
                    "filename": filename,
                    "mime_type": mime,
                    "size": size,
                    "attachment_id": attachment_id,
                }
            )

        for p in part.get("parts", []) or []:
            collect_attachments(p)

    collect_attachments(payload)

    return Response(
        {
            "gmail_id": gmail_id,
            "subject": subject,
            "from": sender,
            "to": to,
            "date": date,
            "body_text": body_text,
            "body_html": body_html,  # we will render safely (no raw dangerous HTML)
            "attachments": attachments,
        }
    )
