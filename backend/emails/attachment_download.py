import base64
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import HttpResponse

from .gmail_service import GmailAuthError, get_gmail_service
from .models import EmailMessage


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def download_attachment(request, gmail_id, attachment_id):
    # Ensure this email belongs to the user (exists in our DB)
    email = EmailMessage.objects.filter(user=request.user, gmail_id=gmail_id).first()
    if not email:
        return Response({"error": "Email not found in DB. Sync first."}, status=404)

    try:
        service = get_gmail_service(request.user, credential=email.gmail_account)
    except GmailAuthError as exc:
        return Response({"error": str(exc), "requires_reconnect": True}, status=400)

    att = (
        service.users()
        .messages()
        .attachments()
        .get(userId="me", messageId=gmail_id, id=attachment_id)
        .execute()
    )

    data = att.get("data")
    if not data:
        return Response({"error": "No attachment data returned"}, status=404)

    # attachment data is base64url
    file_bytes = base64.urlsafe_b64decode(data.encode("utf-8"))

    # If filename is passed from frontend, we can set it; else generic
    filename = request.GET.get("filename", "attachment")

    resp = HttpResponse(file_bytes, content_type="application/octet-stream")
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    return resp
