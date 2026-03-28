import base64
import mimetypes
import re
from collections import Counter
from datetime import datetime, timezone
from email.message import EmailMessage as MIMEEmailMessage
from email.utils import getaddresses, make_msgid

from django.db import IntegrityError
from googleapiclient.errors import HttpError
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ai.utils.project_grouping import infer_project_name, refresh_project_groups_for_user
from .gmail_service import GmailAuthError, get_gmail_service
from .models import EmailMessage, GmailCredential
from .parsing import (
    build_attachment_heading,
    collect_attachments,
    extract_body_text,
    infer_attachment_category,
    infer_attachment_extension,
)

SYNC_BUCKETS = (
    ("all", {}, lambda limit: limit),
    ("starred", {"labelIds": ["STARRED"]}, lambda limit: min(max(limit // 2, 15), 50)),
    ("sent", {"labelIds": ["SENT"]}, lambda limit: min(max(limit // 2, 15), 50)),
    ("drafts", {"labelIds": ["DRAFT"]}, lambda limit: min(max(limit // 3, 10), 25)),
    ("archive", {"q": "-label:inbox -label:sent -label:draft -label:trash"}, lambda limit: min(max(limit // 2, 15), 50)),
    ("trash", {"labelIds": ["TRASH"]}, lambda limit: min(max(limit // 3, 10), 35)),
)

GMAIL_MODIFY_SCOPE = "https://www.googleapis.com/auth/gmail.modify"
FULL_MAIL_SCOPE = "https://mail.google.com/"
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


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


def _get_credential_scopes(user):
    credential = GmailCredential.objects.filter(user=user).first()
    if not credential or not credential.scopes:
        return set()
    return {scope.strip() for scope in credential.scopes.split(",") if scope.strip()}


def _has_scope(user, *required_scopes):
    scopes = _get_credential_scopes(user)
    return any(scope in scopes for scope in required_scopes)


def _update_email_from_labels(email, labels):
    normalized = [label for label in dict.fromkeys(labels or []) if label]
    email.labels = ",".join(normalized)
    email.is_read = "UNREAD" not in normalized
    email.is_starred = "STARRED" in normalized
    email.save(update_fields=["labels", "is_read", "is_starred"])


def _friendly_http_error(exc, action, *, reconnect_scope=None):
    status_code = getattr(getattr(exc, "resp", None), "status", None)

    message = ""
    try:
        content = exc.content.decode("utf-8") if isinstance(exc.content, bytes) else str(exc.content)
        message = f"{exc} {content}".lower()
    except Exception:
        message = str(exc).lower()

    if status_code == 403 and (
        "insufficientpermissions" in message
        or "insufficient permission" in message
        or "insufficient authentication scopes" in message
        or "forbidden" in message
    ):
        reconnect_message = (
            "MailMind needs updated Gmail permissions for this action. Reconnect Gmail and try again."
            if reconnect_scope
            else "MailMind does not have permission for this Gmail action right now. Please reconnect Gmail and try again."
        )
        return Response({"error": reconnect_message, "requires_reconnect": True}, status=400)

    if status_code == 404:
        return Response({"error": "That email is no longer available in Gmail."}, status=404)

    return Response({"error": f"MailMind could not {action} right now. Please try again."}, status=400)


def _get_prediction(email):
    try:
        return email.prediction
    except Exception:
        return None


def _message_defaults_from_gmail(message):
    payload = message.get("payload", {})
    headers = payload.get("headers", [])
    label_ids = list(message.get("labelIds", []) or [])

    subject = next((header.get("value") for header in headers if (header.get("name") or "").lower() == "subject"), None)
    sender = next((header.get("value") for header in headers if (header.get("name") or "").lower() == "from"), None)
    snippet = message.get("snippet")
    full_body_text = extract_body_text(payload) or snippet or ""
    project_name = infer_project_name(subject or "", full_body_text)
    attachments = collect_attachments(payload)

    if attachments and "HAS_ATTACHMENT" not in label_ids:
        label_ids.append("HAS_ATTACHMENT")

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

    return defaults, attachments


def _persist_gmail_message(service, user, gmail_id):
    message = service.users().messages().get(userId="me", id=gmail_id, format="full").execute()
    defaults, attachments = _message_defaults_from_gmail(message)
    email, _ = EmailMessage.objects.update_or_create(
        user=user,
        gmail_id=gmail_id,
        defaults=defaults,
    )
    return email, message, attachments


def _parse_recipient_field(value):
    if isinstance(value, (list, tuple)):
        tokens = []
        for item in value:
            tokens.extend(_parse_recipient_field(item))
        return tokens

    raw = str(value or "").replace(";", ",")
    addresses = []
    for _, email in getaddresses([raw]):
        candidate = (email or "").strip()
        if candidate:
            addresses.append(candidate)
    return list(dict.fromkeys(addresses))


def _invalid_recipient_field(addresses):
    for address in addresses:
        if not EMAIL_RE.match(address):
            return address
    return None


def _build_outgoing_message(
    *,
    sender_email,
    to_addresses,
    cc_addresses,
    bcc_addresses,
    subject,
    body,
    attachments,
    in_reply_to=None,
    references=None,
):
    message = MIMEEmailMessage()
    message["To"] = ", ".join(to_addresses)
    if cc_addresses:
        message["Cc"] = ", ".join(cc_addresses)
    if bcc_addresses:
        message["Bcc"] = ", ".join(bcc_addresses)
    if sender_email:
        message["From"] = sender_email
    message["Subject"] = subject or ""
    message["Message-ID"] = make_msgid(domain=(sender_email.split("@", 1)[1] if sender_email and "@" in sender_email else None))
    if in_reply_to:
        message["In-Reply-To"] = in_reply_to
    if references:
        message["References"] = references

    message.set_content(body or "")

    for attachment in attachments:
        content = attachment.read()
        maintype = "application"
        subtype = "octet-stream"
        guessed_type, _ = mimetypes.guess_type(attachment.name)
        if guessed_type:
            maintype, subtype = guessed_type.split("/", 1)
        message.add_attachment(content, maintype=maintype, subtype=subtype, filename=attachment.name)

    return base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")


def _get_reply_headers(service, gmail_id):
    message = service.users().messages().get(
        userId="me",
        id=gmail_id,
        format="metadata",
        metadataHeaders=["Message-ID", "References", "Subject", "To", "Cc", "From"],
    ).execute()
    headers = {}
    for header in message.get("payload", {}).get("headers", []) or []:
        name = (header.get("name") or "").lower()
        headers[name] = header.get("value")
    return message, headers


def _prepare_outgoing_request(request, *, require_recipient=True):
    data = request.data
    to_addresses = _parse_recipient_field(data.get("to", ""))
    cc_addresses = _parse_recipient_field(data.get("cc", ""))
    bcc_addresses = _parse_recipient_field(data.get("bcc", ""))
    subject = str(data.get("subject") or "").strip()
    body = str(data.get("body") or "")
    reply_to_gmail_id = str(data.get("reply_to_gmail_id") or "").strip() or None
    thread_id = str(data.get("thread_id") or "").strip() or None
    attachments = request.FILES.getlist("attachments")

    if require_recipient and not to_addresses:
        return None, Response({"error": "Add at least one recipient before sending."}, status=400)

    invalid = _invalid_recipient_field(to_addresses + cc_addresses + bcc_addresses)
    if invalid:
        return None, Response({"error": f"\"{invalid}\" is not a valid email address."}, status=400)

    return {
        "to_addresses": to_addresses,
        "cc_addresses": cc_addresses,
        "bcc_addresses": bcc_addresses,
        "subject": subject,
        "body": body,
        "reply_to_gmail_id": reply_to_gmail_id,
        "thread_id": thread_id,
        "attachments": attachments,
    }, None


def _collect_message_ids(service, max_results):
    unique_ids = []
    seen = set()
    coverage = {}

    for bucket_name, params, limit_builder in SYNC_BUCKETS:
        bucket_limit = limit_builder(max_results)
        response = service.users().messages().list(
            userId="me",
            maxResults=bucket_limit,
            **params,
        ).execute()

        bucket_added = 0
        for item in response.get("messages", []):
            gmail_id = item.get("id")
            if not gmail_id or gmail_id in seen:
                continue
            seen.add(gmail_id)
            unique_ids.append(gmail_id)
            bucket_added += 1

        coverage[bucket_name] = bucket_added

    return unique_ids, coverage


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def gmail_status(request):
    credential = GmailCredential.objects.filter(user=request.user).first()
    has_stored_connection = bool(
        credential
        and credential.refresh_token
        and credential.client_id
        and credential.client_secret
        and credential.token_uri
    )

    if not has_stored_connection:
        return Response({"connected": False})

    try:
        service = get_gmail_service(request.user)
        profile = service.users().getProfile(userId="me").execute()
        return Response(
            {
                "connected": True,
                "email_address": profile.get("emailAddress"),
                "messages_total": profile.get("messagesTotal"),
            }
        )
    except GmailAuthError as exc:
        message = str(exc)
        lowered = message.lower()
        requires_reconnect = any(
            marker in lowered
            for marker in ("not connected", "expired", "revoked", "reconnect")
        )
        return Response(
            {
                "connected": has_stored_connection and not requires_reconnect,
                "requires_reconnect": requires_reconnect,
                "message": message,
            }
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def gmail_disconnect(request):
    GmailCredential.objects.filter(user=request.user).delete()
    return Response({"disconnected": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def gmail_sync(request):
    max_results = max(25, min(int(request.data.get("max_results", 80)), 150))

    try:
        service = get_gmail_service(request.user)
    except GmailAuthError as exc:
        return Response({"error": str(exc), "requires_reconnect": True}, status=400)

    messages, mailbox_coverage = _collect_message_ids(service, max_results)
    saved = 0
    skipped = 0
    updated = 0

    for gmail_id in messages:
        message = service.users().messages().get(userId="me", id=gmail_id, format="full").execute()
        defaults, _ = _message_defaults_from_gmail(message)

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

    refresh_project_groups_for_user(request.user)

    return Response(
        {
            "requested": max_results,
            "processed": len(messages),
            "saved": saved,
            "updated": updated,
            "skipped": skipped,
            "mailbox_coverage": mailbox_coverage,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def gmail_send_message(request):
    if not _has_scope(request.user, FULL_MAIL_SCOPE):
        return Response(
            {
                "error": "Reconnect Gmail to let MailMind send messages from your connected account.",
                "requires_reconnect": True,
            },
            status=400,
        )

    payload, error_response = _prepare_outgoing_request(request, require_recipient=True)
    if error_response:
        return error_response

    try:
        service = get_gmail_service(request.user)
        profile = service.users().getProfile(userId="me").execute()
        sender_email = profile.get("emailAddress")

        in_reply_to = None
        references = None
        thread_id = payload["thread_id"]
        if payload["reply_to_gmail_id"]:
            reply_message, reply_headers = _get_reply_headers(service, payload["reply_to_gmail_id"])
            thread_id = thread_id or reply_message.get("threadId")
            in_reply_to = reply_headers.get("message-id")
            references = reply_headers.get("references") or in_reply_to

        raw_message = _build_outgoing_message(
            sender_email=sender_email,
            to_addresses=payload["to_addresses"],
            cc_addresses=payload["cc_addresses"],
            bcc_addresses=payload["bcc_addresses"],
            subject=payload["subject"],
            body=payload["body"],
            attachments=payload["attachments"],
            in_reply_to=in_reply_to,
            references=references,
        )

        body = {"raw": raw_message}
        if thread_id:
            body["threadId"] = thread_id

        sent = service.users().messages().send(userId="me", body=body).execute()
        email, _, attachments = _persist_gmail_message(service, request.user, sent["id"])
        refresh_project_groups_for_user(request.user)
    except GmailAuthError as exc:
        return Response({"error": str(exc), "requires_reconnect": True}, status=400)
    except HttpError as exc:
        return _friendly_http_error(exc, "send the email", reconnect_scope=FULL_MAIL_SCOPE)

    return Response(
        {
            "sent": True,
            "gmail_id": email.gmail_id,
            "thread_id": email.thread_id,
            "mailbox": "sent",
            "attachment_count": len(attachments),
            "message": "Email sent successfully.",
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def gmail_save_draft(request):
    if not _has_scope(request.user, FULL_MAIL_SCOPE):
        return Response(
            {
                "error": "Reconnect Gmail to let MailMind save Gmail drafts from your connected account.",
                "requires_reconnect": True,
            },
            status=400,
        )

    payload, error_response = _prepare_outgoing_request(request, require_recipient=False)
    if error_response:
        return error_response

    try:
        service = get_gmail_service(request.user)
        profile = service.users().getProfile(userId="me").execute()
        sender_email = profile.get("emailAddress")

        in_reply_to = None
        references = None
        thread_id = payload["thread_id"]
        if payload["reply_to_gmail_id"]:
            reply_message, reply_headers = _get_reply_headers(service, payload["reply_to_gmail_id"])
            thread_id = thread_id or reply_message.get("threadId")
            in_reply_to = reply_headers.get("message-id")
            references = reply_headers.get("references") or in_reply_to

        raw_message = _build_outgoing_message(
            sender_email=sender_email,
            to_addresses=payload["to_addresses"],
            cc_addresses=payload["cc_addresses"],
            bcc_addresses=payload["bcc_addresses"],
            subject=payload["subject"],
            body=payload["body"],
            attachments=payload["attachments"],
            in_reply_to=in_reply_to,
            references=references,
        )

        body = {"message": {"raw": raw_message}}
        if thread_id:
            body["message"]["threadId"] = thread_id

        draft = service.users().drafts().create(userId="me", body=body).execute()
        draft_message = draft.get("message") or {}
        gmail_id = draft_message.get("id")
        if not gmail_id:
            return Response({"error": "MailMind could not confirm the saved draft."}, status=400)

        email, _, attachments = _persist_gmail_message(service, request.user, gmail_id)
        refresh_project_groups_for_user(request.user)
    except GmailAuthError as exc:
        return Response({"error": str(exc), "requires_reconnect": True}, status=400)
    except HttpError as exc:
        return _friendly_http_error(exc, "save the draft", reconnect_scope=FULL_MAIL_SCOPE)

    return Response(
        {
            "saved": True,
            "gmail_id": email.gmail_id,
            "thread_id": email.thread_id,
            "mailbox": "drafts",
            "attachment_count": len(attachments),
            "message": "Draft saved successfully.",
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


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def gmail_trash_message(request, gmail_id):
    email = EmailMessage.objects.filter(user=request.user, gmail_id=gmail_id).first()
    if not email:
        return Response({"error": "Email not found in MailMind."}, status=404)

    if not _has_scope(request.user, GMAIL_MODIFY_SCOPE, FULL_MAIL_SCOPE):
        return Response(
            {
                "error": "Reconnect Gmail to enable MailMind to move emails into Trash.",
                "requires_reconnect": True,
            },
            status=400,
        )

    try:
        service = get_gmail_service(request.user)
        response = service.users().messages().trash(userId="me", id=gmail_id).execute()
    except GmailAuthError as exc:
        return Response({"error": str(exc), "requires_reconnect": True}, status=400)
    except HttpError as exc:
        return _friendly_http_error(exc, "move the email to Trash", reconnect_scope=GMAIL_MODIFY_SCOPE)

    labels = response.get("labelIds")
    if labels:
        _update_email_from_labels(email, labels)
    else:
        existing = [label for label in (email.labels or "").split(",") if label and label != "INBOX"]
        if "TRASH" not in existing:
            existing.append("TRASH")
        _update_email_from_labels(email, existing)

    return Response({"gmail_id": gmail_id, "labels": email.labels.split(",") if email.labels else [], "trashed": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def gmail_restore_message(request, gmail_id):
    email = EmailMessage.objects.filter(user=request.user, gmail_id=gmail_id).first()
    if not email:
        return Response({"error": "Email not found in MailMind."}, status=404)

    if not _has_scope(request.user, GMAIL_MODIFY_SCOPE, FULL_MAIL_SCOPE):
        return Response(
            {
                "error": "Reconnect Gmail to enable MailMind to restore emails from Trash.",
                "requires_reconnect": True,
            },
            status=400,
        )

    try:
        service = get_gmail_service(request.user)
        response = service.users().messages().untrash(userId="me", id=gmail_id).execute()
    except GmailAuthError as exc:
        return Response({"error": str(exc), "requires_reconnect": True}, status=400)
    except HttpError as exc:
        return _friendly_http_error(exc, "restore the email", reconnect_scope=GMAIL_MODIFY_SCOPE)

    labels = response.get("labelIds")
    if labels:
        _update_email_from_labels(email, labels)
    else:
        existing = [label for label in (email.labels or "").split(",") if label and label != "TRASH"]
        if not any(label in existing for label in ("INBOX", "SENT", "DRAFT")):
            existing.append("INBOX")
        _update_email_from_labels(email, existing)

    return Response({"gmail_id": gmail_id, "labels": email.labels.split(",") if email.labels else [], "restored": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def gmail_empty_trash(request):
    if not _has_scope(request.user, FULL_MAIL_SCOPE):
        return Response(
            {
                "error": "Reconnect Gmail to let MailMind permanently empty Trash.",
                "requires_reconnect": True,
            },
            status=400,
        )

    try:
        service = get_gmail_service(request.user)
    except GmailAuthError as exc:
        return Response({"error": str(exc), "requires_reconnect": True}, status=400)

    deleted_ids = []
    page_token = None

    try:
        while True:
            response = service.users().messages().list(
                userId="me",
                q="in:trash",
                maxResults=500,
                pageToken=page_token,
            ).execute()

            batch_ids = [item.get("id") for item in response.get("messages", []) if item.get("id")]
            for gmail_id in batch_ids:
                service.users().messages().delete(userId="me", id=gmail_id).execute()
                deleted_ids.append(gmail_id)

            page_token = response.get("nextPageToken")
            if not page_token:
                break
    except HttpError as exc:
        return _friendly_http_error(exc, "empty Trash", reconnect_scope=FULL_MAIL_SCOPE)

    trashed_queryset = EmailMessage.objects.filter(user=request.user, labels__icontains="TRASH")
    if deleted_ids:
        trashed_queryset.filter(gmail_id__in=deleted_ids).delete()
        trashed_queryset.exclude(gmail_id__in=deleted_ids).delete()
    else:
        trashed_queryset.delete()

    return Response({"deleted": len(deleted_ids)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def gmail_attachments(request):
    limit = max(40, min(int(request.GET.get("limit", 160)), 250))

    try:
        service = get_gmail_service(request.user)
    except GmailAuthError as exc:
        return Response({"error": str(exc), "requires_reconnect": True}, status=400)

    emails = list(
        EmailMessage.objects.filter(user=request.user, labels__icontains="HAS_ATTACHMENT")
        .order_by("-internal_date", "-created_at")[:limit]
    )

    if not emails:
        fallback = service.users().messages().list(userId="me", q="has:attachment", maxResults=min(limit, 80)).execute()
        for item in fallback.get("messages", []):
            gmail_id = item.get("id")
            if not gmail_id:
                continue
            message = service.users().messages().get(userId="me", id=gmail_id, format="full").execute()
            defaults, _ = _message_defaults_from_gmail(message)
            email, _ = EmailMessage.objects.update_or_create(
                user=request.user,
                gmail_id=gmail_id,
                defaults=defaults,
            )
            emails.append(email)
        if emails:
            refresh_project_groups_for_user(request.user)

    items = []
    type_counts = Counter()
    total_size = 0

    for email in emails:
        message = service.users().messages().get(userId="me", id=email.gmail_id, format="full").execute()
        attachments = collect_attachments(message.get("payload", {}))

        for attachment in attachments:
            category = infer_attachment_category(attachment["filename"], attachment["mime_type"])
            size = int(attachment.get("size") or 0)
            total_size += size
            type_counts[category] += 1

            items.append(
                {
                    "id": f"{email.gmail_id}-{attachment['attachment_id']}",
                    "gmail_id": email.gmail_id,
                    "attachment_id": attachment["attachment_id"],
                    "heading": build_attachment_heading(attachment["filename"], email.subject or ""),
                    "name": attachment["filename"],
                    "email_subject": email.subject,
                    "sender": email.sender,
                    "project_name": email.project_name,
                    "type": category,
                    "extension": infer_attachment_extension(attachment["filename"]),
                    "mime_type": attachment["mime_type"],
                    "size": size,
                    "internal_date": email.internal_date.isoformat() if email.internal_date else None,
                }
            )

    items.sort(key=lambda item: item["internal_date"] or "", reverse=True)

    return Response(
        {
            "count": len(items),
            "items": items,
            "stats": {
                "total": len(items),
                "images": type_counts.get("image", 0),
                "documents": sum(
                    type_counts.get(key, 0) for key in ("pdf", "doc", "spreadsheet", "presentation", "text")
                ),
                "other": sum(
                    type_counts.get(key, 0) for key in ("archive", "audio", "video", "other")
                ),
                "total_size": total_size,
            },
            "type_counts": dict(type_counts),
        }
    )


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
    project_name = email.project_name or infer_project_name(email.subject or "", body)

    fields_to_update = []
    if body and body != email.full_body_text:
        email.full_body_text = body
        fields_to_update.append("full_body_text")
    if project_name and not email.project_name:
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
