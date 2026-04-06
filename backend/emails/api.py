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
from .gmail_service import (
    GmailAuthError,
    get_active_gmail_credential,
    get_gmail_service,
    list_gmail_credentials,
    resolve_gmail_credential,
    serialize_gmail_credential,
    set_active_gmail_credential,
)
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
    ("starred", {"labelIds": ["STARRED"]}, lambda limit: min(max(limit // 2, 20), 120)),
    ("sent", {"labelIds": ["SENT"]}, lambda limit: min(max(limit // 2, 20), 160)),
    ("drafts", {"labelIds": ["DRAFT"]}, lambda limit: min(max(limit // 3, 15), 80)),
    ("archive", {"q": "-label:inbox -label:sent -label:draft -label:trash"}, lambda limit: min(max(limit // 2, 20), 140)),
    ("trash", {"labelIds": ["TRASH"]}, lambda limit: min(max(limit // 3, 15), 100)),
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


def _get_credential_scopes(credential):
    if not credential or not credential.scopes:
        return set()
    return {scope.strip() for scope in credential.scopes.split(",") if scope.strip()}


def _has_scope(credential, *required_scopes):
    scopes = _get_credential_scopes(credential)
    return any(scope in scopes for scope in required_scopes)


def _connected_credentials(user):
    return list(
        list_gmail_credentials(user).filter(
            refresh_token__isnull=False,
            client_id__isnull=False,
            client_secret__isnull=False,
            token_uri__isnull=False,
        )
    )


def _active_or_connected_credential(user):
    active = get_active_gmail_credential(user)
    if active and active.refresh_token:
        return active

    for credential in _connected_credentials(user):
        set_active_gmail_credential(user, credential)
        return credential
    return None


def _email_lookup(user, gmail_id):
    return (
        EmailMessage.objects.filter(user=user, gmail_id=gmail_id)
        .select_related("prediction", "gmail_account")
        .prefetch_related("tasks")
        .order_by("-internal_date", "-created_at")
        .first()
    )


def _credential_summary_payload(user, active_credential=None):
    accounts = [serialize_gmail_credential(credential) for credential in list_gmail_credentials(user)]
    active = active_credential or get_active_gmail_credential(user)
    connected_accounts = [account for account in accounts if account["connected"]]
    return {
        "accounts": accounts,
        "connected": bool(connected_accounts),
        "connected_accounts": len(connected_accounts),
        "active_account_id": active.id if active else None,
        "email_address": active.email_address if active else "",
    }


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
        "attachment_metadata": attachments,
    }

    return defaults, attachments


def _persist_gmail_message(service, user, gmail_id, credential):
    message = service.users().messages().get(userId="me", id=gmail_id, format="full").execute()
    defaults, attachments = _message_defaults_from_gmail(message)
    defaults["gmail_account"] = credential
    defaults["source_email"] = credential.email_address or ""
    email, created = EmailMessage.objects.update_or_create(
        user=user,
        gmail_id=gmail_id,
        source_email=credential.email_address or "",
        defaults=defaults,
    )
    return email, message, attachments, created


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


def _resolve_outgoing_credential(user, payload):
    reply_email = None
    credential = None

    if payload["reply_to_gmail_id"]:
        reply_email = _email_lookup(user, payload["reply_to_gmail_id"])
        if reply_email and reply_email.gmail_account_id:
            credential = reply_email.gmail_account

    credential = credential or _active_or_connected_credential(user)
    return credential, reply_email


def _service_for_email(user, email):
    credential = email.gmail_account or _active_or_connected_credential(user)
    if not credential:
        raise GmailAuthError("This email is no longer linked to an active Gmail account. Reconnect the account and try again.")
    return get_gmail_service(user, credential=credential), credential


def _merge_gmail_query(base_query="", extra_query=""):
    parts = [part.strip() for part in (base_query, extra_query) if str(part or "").strip()]
    return " ".join(parts)


def _list_bucket_message_ids(service, *, max_results, recent_only=False, **params):
    unique_ids = []
    seen = set()
    page_token = None
    base_query = params.get("q", "")
    scoped_query = _merge_gmail_query(base_query, "newer_than:2d") if recent_only else base_query

    while len(unique_ids) < max_results:
        batch_size = min(100, max_results - len(unique_ids))
        request_kwargs = {
            "userId": "me",
            "maxResults": max(batch_size, 1),
        }

        if params.get("labelIds"):
            request_kwargs["labelIds"] = params["labelIds"]
        if scoped_query:
            request_kwargs["q"] = scoped_query
        if page_token:
            request_kwargs["pageToken"] = page_token

        response = service.users().messages().list(**request_kwargs).execute()
        messages = response.get("messages", [])
        if not messages:
            break

        for item in messages:
            gmail_id = item.get("id")
            if not gmail_id or gmail_id in seen:
                continue
            seen.add(gmail_id)
            unique_ids.append(gmail_id)
            if len(unique_ids) >= max_results:
                break

        page_token = response.get("nextPageToken")
        if not page_token:
            break

    return unique_ids


def _collect_message_ids(service, max_results, *, recent_only=False):
    unique_ids = []
    seen = set()
    coverage = {}

    for bucket_name, params, limit_builder in SYNC_BUCKETS:
        bucket_limit = limit_builder(max_results)
        bucket_added = 0
        bucket_ids = _list_bucket_message_ids(
            service,
            max_results=bucket_limit,
            recent_only=recent_only,
            **params,
        )

        for gmail_id in bucket_ids:
            if gmail_id in seen:
                continue
            seen.add(gmail_id)
            unique_ids.append(gmail_id)
            bucket_added += 1

        coverage[bucket_name] = bucket_added

    return unique_ids, coverage


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def gmail_status(request):
    active_credential = _active_or_connected_credential(request.user)
    payload = _credential_summary_payload(request.user, active_credential=active_credential)

    if not active_credential:
        return Response({**payload, "connected": False})

    try:
        service = get_gmail_service(request.user, credential=active_credential)
        profile = service.users().getProfile(userId="me").execute()
        active_credential.email_address = active_credential.email_address or profile.get("emailAddress") or ""
        if active_credential.email_address:
            active_credential.save(update_fields=["email_address", "updated_at"])
        payload = _credential_summary_payload(request.user, active_credential=active_credential)
        return Response(
            {
                **payload,
                "connected": True,
                "email_address": active_credential.email_address,
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
                **payload,
                "connected": payload["connected"] and not requires_reconnect,
                "requires_reconnect": requires_reconnect,
                "message": message,
            }
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def gmail_disconnect(request):
    credential = get_active_gmail_credential(request.user)
    if not credential:
        return Response({"error": "No active Gmail account is connected right now."}, status=404)

    disconnected_email = credential.email_address
    credential.delete()

    next_credential = get_active_gmail_credential(request.user)
    if next_credential and not next_credential.is_active:
        set_active_gmail_credential(request.user, next_credential)

    return Response(
        {
            "disconnected": True,
            "email_address": disconnected_email,
            **_credential_summary_payload(request.user),
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def gmail_activate_account(request, credential_id):
    credential = resolve_gmail_credential(request.user, credential_id=credential_id)
    if not credential:
        return Response({"error": "That Gmail account is not available for this MailMind user."}, status=404)

    if not credential.refresh_token:
        return Response(
            {"error": "This Gmail account needs to be reconnected before MailMind can use it."},
            status=400,
        )

    set_active_gmail_credential(request.user, credential)
    return Response(
        {
            "message": f"{credential.email_address or 'Gmail account'} is now the active inbox.",
            **_credential_summary_payload(request.user, active_credential=credential),
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def gmail_disconnect_account(request, credential_id):
    credential = resolve_gmail_credential(request.user, credential_id=credential_id)
    if not credential:
        return Response({"error": "That Gmail account was not found."}, status=404)

    disconnected_email = credential.email_address
    was_active = credential.is_active
    credential.delete()

    if was_active:
        next_credential = get_active_gmail_credential(request.user)
        if next_credential and not next_credential.is_active:
            set_active_gmail_credential(request.user, next_credential)

    return Response(
        {
            "message": f"{disconnected_email or 'Gmail account'} disconnected successfully.",
            "disconnected": True,
            **_credential_summary_payload(request.user),
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def gmail_sync(request):
    sync_mode = str(request.data.get("mode") or "full").strip().lower()
    recent_only = sync_mode == "latest"
    default_limit = 45 if recent_only else 240
    cap_limit = 90 if recent_only else 600
    max_results = max(20 if recent_only else 50, min(int(request.data.get("max_results", default_limit)), cap_limit))

    credentials = _connected_credentials(request.user)
    if not credentials:
        return Response({"error": "Gmail is not connected. Please connect Gmail first.", "requires_reconnect": True}, status=400)

    saved = 0
    skipped = 0
    updated = 0
    processed = 0
    mailbox_coverage = Counter()
    account_summaries = []

    for credential in credentials:
        try:
            service = get_gmail_service(request.user, credential=credential)
        except GmailAuthError as exc:
            account_summaries.append(
                {
                    "id": credential.id,
                    "email_address": credential.email_address,
                    "processed": 0,
                    "saved": 0,
                    "updated": 0,
                    "skipped": 0,
                    "error": str(exc),
                }
            )
            continue

        messages, account_coverage = _collect_message_ids(service, max_results, recent_only=recent_only)
        account_saved = 0
        account_updated = 0
        account_skipped = 0

        for gmail_id in messages:
            try:
                _, _, _, created = _persist_gmail_message(service, request.user, gmail_id, credential)
                if created:
                    saved += 1
                    account_saved += 1
                else:
                    updated += 1
                    account_updated += 1
            except IntegrityError:
                skipped += 1
                account_skipped += 1

        processed += len(messages)
        mailbox_coverage.update(account_coverage)
        account_summaries.append(
            {
                "id": credential.id,
                "email_address": credential.email_address,
                "processed": len(messages),
                "saved": account_saved,
                "updated": account_updated,
                "skipped": account_skipped,
                "mailbox_coverage": account_coverage,
            }
        )

    refresh_project_groups_for_user(request.user)

    return Response(
        {
            "requested_per_account": max_results,
            "mode": sync_mode,
            "connected_accounts": len(credentials),
            "processed": processed,
            "saved": saved,
            "updated": updated,
            "skipped": skipped,
            "mailbox_coverage": dict(mailbox_coverage),
            "accounts": account_summaries,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def gmail_send_message(request):
    payload, error_response = _prepare_outgoing_request(request, require_recipient=True)
    if error_response:
        return error_response

    credential, _ = _resolve_outgoing_credential(request.user, payload)
    if not credential:
        return Response(
            {"error": "Connect a Gmail account before sending email.", "requires_reconnect": True},
            status=400,
        )

    if not _has_scope(credential, FULL_MAIL_SCOPE):
        return Response(
            {
                "error": "Reconnect Gmail to let MailMind send messages from this connected account.",
                "requires_reconnect": True,
            },
            status=400,
        )

    try:
        service = get_gmail_service(request.user, credential=credential)
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
        email, _, attachments, _ = _persist_gmail_message(service, request.user, sent["id"], credential)
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
    payload, error_response = _prepare_outgoing_request(request, require_recipient=False)
    if error_response:
        return error_response

    credential, _ = _resolve_outgoing_credential(request.user, payload)
    if not credential:
        return Response(
            {"error": "Connect a Gmail account before saving drafts.", "requires_reconnect": True},
            status=400,
        )

    if not _has_scope(credential, FULL_MAIL_SCOPE):
        return Response(
            {
                "error": "Reconnect Gmail to let MailMind save drafts from this connected account.",
                "requires_reconnect": True,
            },
            status=400,
        )

    try:
        service = get_gmail_service(request.user, credential=credential)
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

        email, _, attachments, _ = _persist_gmail_message(service, request.user, gmail_id, credential)
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
    limit = max(50, min(int(request.GET.get("limit", 250)), 1500))
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
                "source_email": email.source_email,
                "gmail_account_id": email.gmail_account_id,
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
    email = _email_lookup(request.user, gmail_id)
    if not email:
        return Response({"error": "Email not found in MailMind."}, status=404)

    credential = email.gmail_account or _active_or_connected_credential(request.user)
    if not _has_scope(credential, GMAIL_MODIFY_SCOPE, FULL_MAIL_SCOPE):
        return Response(
            {
                "error": "Reconnect Gmail to enable MailMind to move emails into Trash.",
                "requires_reconnect": True,
            },
            status=400,
        )

    try:
        service = get_gmail_service(request.user, credential=credential)
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
    email = _email_lookup(request.user, gmail_id)
    if not email:
        return Response({"error": "Email not found in MailMind."}, status=404)

    credential = email.gmail_account or _active_or_connected_credential(request.user)
    if not _has_scope(credential, GMAIL_MODIFY_SCOPE, FULL_MAIL_SCOPE):
        return Response(
            {
                "error": "Reconnect Gmail to enable MailMind to restore emails from Trash.",
                "requires_reconnect": True,
            },
            status=400,
        )

    try:
        service = get_gmail_service(request.user, credential=credential)
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
    credentials = _connected_credentials(request.user)
    if not credentials:
        return Response(
            {
                "error": "Reconnect Gmail to let MailMind permanently empty Trash.",
                "requires_reconnect": True,
            },
            status=400,
        )

    if not all(_has_scope(credential, FULL_MAIL_SCOPE) for credential in credentials):
        return Response(
            {
                "error": "Reconnect Gmail to let MailMind permanently empty Trash.",
                "requires_reconnect": True,
            },
            status=400,
        )

    deleted_ids = []
    deleted_pairs = []

    for credential in credentials:
        try:
            service = get_gmail_service(request.user, credential=credential)
        except GmailAuthError as exc:
            return Response({"error": str(exc), "requires_reconnect": True}, status=400)

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
                    deleted_pairs.append((gmail_id, credential.email_address or ""))

                page_token = response.get("nextPageToken")
                if not page_token:
                    break
        except HttpError as exc:
            return _friendly_http_error(exc, "empty Trash", reconnect_scope=FULL_MAIL_SCOPE)

    for gmail_id, source_email in deleted_pairs:
        EmailMessage.objects.filter(user=request.user, gmail_id=gmail_id, source_email=source_email).delete()

    return Response({"deleted": len(deleted_ids)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def gmail_attachments(request):
    limit = max(40, min(int(request.GET.get("limit", 160)), 250))

    emails = list(
        EmailMessage.objects.filter(user=request.user, labels__icontains="HAS_ATTACHMENT")
        .order_by("-internal_date", "-created_at")[:limit]
    )

    items = []
    type_counts = Counter()
    total_size = 0

    for email in emails:
        cached = email.attachment_metadata or []

        # If this email has no cached metadata yet, fetch once from Gmail and persist it
        if not cached:
            try:
                service, _ = _service_for_email(request.user, email)
                message = service.users().messages().get(userId="me", id=email.gmail_id, format="full").execute()
                cached = collect_attachments(message.get("payload", {}))
                if cached:
                    email.attachment_metadata = cached
                    email.save(update_fields=["attachment_metadata"])
            except GmailAuthError:
                continue
            except Exception:
                continue

        for attachment in cached:
            filename = attachment.get("filename") or ""
            mime_type = attachment.get("mime_type") or ""
            attachment_id = attachment.get("attachment_id") or ""
            if not filename or not attachment_id:
                continue

            category = infer_attachment_category(filename, mime_type)
            size = int(attachment.get("size") or 0)
            total_size += size
            type_counts[category] += 1

            items.append(
                {
                    "id": f"{email.gmail_id}-{attachment_id}",
                    "gmail_id": email.gmail_id,
                    "attachment_id": attachment_id,
                    "heading": build_attachment_heading(filename, email.subject or ""),
                    "name": filename,
                    "email_subject": email.subject,
                    "sender": email.sender,
                    "source_email": email.source_email,
                    "project_name": email.project_name,
                    "type": category,
                    "extension": infer_attachment_extension(filename),
                    "mime_type": mime_type,
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
    email = _email_lookup(request.user, gmail_id)
    if not email:
        return Response({"error": "Email not found in DB. Sync first."}, status=404)

    try:
        service, _ = _service_for_email(request.user, email)
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
            "source_email": email.source_email,
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
