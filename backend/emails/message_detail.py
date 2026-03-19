from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ai.utils.project_grouping import infer_project_name
from .gmail_service import GmailAuthError, get_gmail_service
from .models import EmailMessage
from .parsing import collect_attachments, decode_b64url, find_part, get_header


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def gmail_message_detail(request, gmail_id):
    email = EmailMessage.objects.filter(user=request.user, gmail_id=gmail_id).first()
    if not email:
        return Response({"error": "Email not found in DB. Sync first."}, status=404)

    try:
        service = get_gmail_service(request.user)
    except GmailAuthError as exc:
        return Response({"error": str(exc), "requires_reconnect": True}, status=400)
    message = service.users().messages().get(userId="me", id=gmail_id, format="full").execute()

    payload = message.get("payload", {})
    headers = payload.get("headers", [])

    subject = get_header(headers, "Subject") or email.subject
    sender = get_header(headers, "From") or email.sender
    recipient = get_header(headers, "To")
    date = get_header(headers, "Date")

    text_part = find_part(payload, "text/plain")
    html_part = find_part(payload, "text/html")

    body_text = ""
    body_html = ""

    if text_part:
        body_text = decode_b64url(text_part.get("body", {}).get("data", ""))
    elif payload.get("mimeType") == "text/plain" and payload.get("body", {}).get("data"):
        body_text = decode_b64url(payload.get("body", {}).get("data", ""))

    if html_part:
        body_html = decode_b64url(html_part.get("body", {}).get("data", ""))
    elif payload.get("mimeType") == "text/html" and payload.get("body", {}).get("data"):
        body_html = decode_b64url(payload.get("body", {}).get("data", ""))

    stored_body = body_text or email.full_body_text or email.snippet or ""
    project_name = infer_project_name(subject or "", stored_body)

    update_fields = []
    if stored_body and stored_body != email.full_body_text:
        email.full_body_text = stored_body
        update_fields.append("full_body_text")
    if project_name and project_name != email.project_name:
        email.project_name = project_name
        update_fields.append("project_name")
    if update_fields:
        email.save(update_fields=update_fields)

    return Response(
        {
            "gmail_id": gmail_id,
            "subject": subject,
            "from": sender,
            "to": recipient,
            "date": date,
            "project_name": email.project_name,
            "body_text": stored_body,
            "body_html": body_html,
            "attachments": collect_attachments(payload),
        }
    )
