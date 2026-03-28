from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from googleapiclient.errors import HttpError

from ai.utils.project_grouping import infer_project_name
from ai.services.email_summary import summarize_email
from .gmail_service import GmailAuthError, get_gmail_service
from .models import EmailMessage
from .parsing import collect_attachments, decode_b64url, find_part, get_header, html_to_text


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def gmail_message_detail(request, gmail_id):
    email = (
        EmailMessage.objects.filter(user=request.user, gmail_id=gmail_id)
        .select_related("prediction")
        .prefetch_related("tasks")
        .first()
    )
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
    cc_recipient = get_header(headers, "Cc")
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
        if not body_text:
            body_text = html_to_text(body_html)
    elif payload.get("mimeType") == "text/html" and payload.get("body", {}).get("data"):
        body_html = decode_b64url(payload.get("body", {}).get("data", ""))
        if not body_text:
            body_text = html_to_text(body_html)

    stored_body = body_text or email.full_body_text or email.snippet or ""
    project_name = email.project_name or infer_project_name(subject or "", stored_body)
    summary = summarize_email(
        subject or "",
        stored_body,
        tasks=[task.task_text for task in email.tasks.all()],
    )

    update_fields = []
    label_values = [label for label in (email.labels or "").split(",") if label]

    if not email.is_read:
        email.is_read = True
        update_fields.append("is_read")

    if "UNREAD" in label_values:
        label_values = [label for label in label_values if label != "UNREAD"]
        email.labels = ",".join(label_values)
        update_fields.append("labels")

    try:
        if "UNREAD" in (message.get("labelIds") or []):
            updated_message = service.users().messages().modify(
                userId="me",
                id=gmail_id,
                body={"removeLabelIds": ["UNREAD"]},
            ).execute()
            updated_labels = updated_message.get("labelIds") or label_values
            email.labels = ",".join(updated_labels)
            email.is_read = "UNREAD" not in updated_labels
            if "labels" not in update_fields:
                update_fields.append("labels")
            if "is_read" not in update_fields:
                update_fields.append("is_read")
    except HttpError:
        # Older Gmail connections may still be using readonly scope. Keep the preview usable
        # and let the local unread state update even if Gmail itself cannot be modified yet.
        pass

    if stored_body and stored_body != email.full_body_text:
        email.full_body_text = stored_body
        update_fields.append("full_body_text")
    if project_name and not email.project_name:
        email.project_name = project_name
        update_fields.append("project_name")
    if update_fields:
        email.save(update_fields=update_fields)

    return Response(
        {
            "gmail_id": gmail_id,
            "thread_id": email.thread_id,
            "subject": subject,
            "from": sender,
            "to": recipient,
            "cc": cc_recipient,
            "date": date,
            "project_name": email.project_name,
            "body_text": stored_body,
            "body_html": body_html,
            "summary": summary,
            "attachments": collect_attachments(payload),
        }
    )
