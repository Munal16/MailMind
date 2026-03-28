import re
from datetime import datetime, timedelta

from django.utils import timezone

from ai.utils.text_preprocessing import normalize_text
from emails.gmail_service import GmailAuthError, get_gmail_service
from emails.parsing import collect_attachments


STOPWORDS = {
    "find",
    "show",
    "me",
    "the",
    "a",
    "an",
    "that",
    "those",
    "these",
    "emails",
    "email",
    "message",
    "messages",
    "mail",
    "please",
    "with",
    "about",
    "related",
    "for",
    "of",
    "in",
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

MAILBOX_HINTS = {
    "unread": "unread",
    "starred": "starred",
    "sent": "sent",
    "draft": "drafts",
    "drafts": "drafts",
    "archive": "archive",
    "archived": "archive",
    "trash": "trash",
    "deleted": "trash",
    "priority": "priority",
    "urgent": "priority",
}

ATTACHMENT_TYPE_HINTS = {
    "image": {"image", "images", "photo", "photos", "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"},
    "pdf": {"pdf"},
    "doc": {"doc", "docs", "document", "documents", "docx", "word"},
    "spreadsheet": {"sheet", "sheets", "spreadsheet", "spreadsheets", "xls", "xlsx", "csv"},
    "presentation": {"ppt", "pptx", "presentation", "slides"},
    "text": {"txt", "text"},
    "archive": {"zip", "rar", "7z", "archive"},
    "audio": {"audio", "mp3", "wav", "m4a"},
    "video": {"video", "mp4", "mov", "avi", "mkv"},
}

SENDER_PATTERNS = [
    re.compile(
        r"(?:emails?|mail|messages?)\s+(?:from|by)\s+([a-z0-9@._\-\s]+?)(?=\s+(?:with|about|that|who|having|containing|regarding|in|on)\b|$)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:from|by|sent by)\s+([a-z0-9@._\-\s]+?)(?=\s+(?:with|about|that|who|having|containing|regarding|in|on)\b|$)",
        re.IGNORECASE,
    ),
]


def _get_prediction(email):
    try:
        return email.prediction
    except Exception:
        return None


def _label_set(email):
    raw_labels = str(email.labels or "")
    return {label.strip() for label in raw_labels.split(",") if label.strip()}


def _has_attachment(email):
    return "HAS_ATTACHMENT" in _label_set(email)


def _email_matches_mailbox(email, mailbox):
    labels = _label_set(email)
    if mailbox == "unread":
        return not email.is_read and "TRASH" not in labels
    if mailbox == "starred":
        return email.is_starred and "TRASH" not in labels
    if mailbox == "sent":
        return "SENT" in labels and "TRASH" not in labels
    if mailbox == "drafts":
        return "DRAFT" in labels and "TRASH" not in labels
    if mailbox == "archive":
        return "INBOX" not in labels and "SENT" not in labels and "DRAFT" not in labels and "TRASH" not in labels
    if mailbox == "trash":
        return "TRASH" in labels
    if mailbox == "priority":
        prediction = _get_prediction(email)
        return bool(prediction and prediction.priority_score and prediction.priority_score >= 50)
    return True


def _attachment_type_for(attachment):
    mime_type = str(attachment.get("mime_type") or "").lower()
    filename = str(attachment.get("filename") or "").lower()
    extension = filename.rsplit(".", 1)[-1] if "." in filename else ""

    if mime_type.startswith("image/") or extension in {"png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"}:
        return "image"
    if extension == "pdf" or mime_type == "application/pdf":
        return "pdf"
    if extension in {"doc", "docx"} or "word" in mime_type:
        return "doc"
    if extension in {"xls", "xlsx", "csv"} or "sheet" in mime_type or "excel" in mime_type:
        return "spreadsheet"
    if extension in {"ppt", "pptx"} or "presentation" in mime_type:
        return "presentation"
    if extension in {"txt", "md"} or mime_type.startswith("text/"):
        return "text"
    if extension in {"zip", "rar", "7z"} or "compressed" in mime_type or "zip" in mime_type:
        return "archive"
    if mime_type.startswith("audio/"):
        return "audio"
    if mime_type.startswith("video/"):
        return "video"
    return "other"


def _parse_sender_terms(text: str):
    matches = []
    for pattern in SENDER_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue

        candidate = normalize_text(match.group(1)).lower()
        candidate = re.sub(r"\b(email|emails|message|messages|mail)\b", " ", candidate)
        candidate = re.sub(r"\s+", " ", candidate).strip()
        if candidate:
            matches.append(candidate)

    return matches


def _detect_attachment_type(text: str):
    for attachment_type, keywords in ATTACHMENT_TYPE_HINTS.items():
        if any(keyword in text for keyword in keywords):
            return attachment_type
    return None


def _detect_mailbox(text: str):
    for keyword, mailbox in MAILBOX_HINTS.items():
        if re.search(rf"\b{re.escape(keyword)}\b", text):
            return mailbox
    return None


def _parse_query(query: str):
    text = normalize_text(query).lower()
    sender_terms = _parse_sender_terms(text)

    tokens = [token for token in re.findall(r"[a-z0-9#@._/-]+", text) if token not in STOPWORDS]
    for sender_term in sender_terms:
        tokens = [token for token in tokens if token not in sender_term.split()]

    wants_tasks = any(keyword in text for keyword in ["task", "tasks", "action", "todo", "follow up", "follow-up", "deadline"])
    wants_attachments = any(
        keyword in text for keyword in ["attachment", "attachments", "file", "files", "document", "documents", "pdf", "doc", "image", "images"]
    )

    attachment_type = _detect_attachment_type(text)
    mailbox = _detect_mailbox(text)

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
    elif "last month" in text:
        date_from = now - timedelta(days=30)

    return {
        "raw": text,
        "tokens": tokens,
        "intent": intent,
        "urgency": urgency,
        "wants_tasks": wants_tasks,
        "wants_attachments": wants_attachments,
        "attachment_type": attachment_type,
        "date_from": date_from,
        "sender_terms": sender_terms,
        "mailbox": mailbox,
    }


def _score_email(email, parsed):
    if parsed["date_from"] and email.internal_date and email.internal_date < parsed["date_from"]:
        return 0, []

    if parsed["mailbox"] and not _email_matches_mailbox(email, parsed["mailbox"]):
        return 0, []

    score = 0
    reasons = []

    subject = normalize_text(email.subject).lower()
    sender = normalize_text(email.sender).lower()
    snippet = normalize_text(email.snippet).lower()
    body = normalize_text(email.full_body_text).lower()
    project_name = normalize_text(getattr(email, "project_name", "")).lower()
    task_text = " ".join(normalize_text(task.task_text).lower() for task in email.tasks.all())
    combined = f"{subject} {sender} {snippet} {body} {project_name} {task_text}"

    haystacks = [
        (subject, 8, "subject"),
        (project_name, 7, "project"),
        (sender, 10, "sender"),
        (snippet, 4, "snippet"),
        (body, 3, "body"),
        (task_text, 7, "task"),
    ]

    if parsed["raw"] and parsed["raw"] in combined:
        score += 10
        reasons.append("phrase")

    if parsed["sender_terms"]:
        if any(term in sender for term in parsed["sender_terms"]):
            score += 16
            reasons.append("sender")
        else:
            return 0, []

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
        score += 6
        reasons.append("tasks")

    if parsed["wants_attachments"] or parsed["attachment_type"]:
        if _has_attachment(email):
            score += 7
            reasons.append("attachments")
        else:
            return 0, []

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


def _collect_attachment_results(user, emails, parsed, limit=8):
    attachments = []
    matching_email_ids = set()
    candidate_emails = [email for email in emails if _has_attachment(email)]

    if not candidate_emails:
        return attachments, matching_email_ids

    try:
        service = get_gmail_service(user)
    except GmailAuthError:
        return attachments, matching_email_ids

    for email in candidate_emails[:40]:
        try:
            message = service.users().messages().get(userId="me", id=email.gmail_id, format="full").execute()
        except Exception:
            continue

        for attachment in collect_attachments(message.get("payload", {})):
            attachment_type = _attachment_type_for(attachment)
            search_blob = normalize_text(
                f"{attachment['filename']} {email.subject or ''} {email.sender or ''} {email.project_name or ''}"
            ).lower()

            if parsed["attachment_type"] and attachment_type != parsed["attachment_type"]:
                continue

            if parsed["tokens"] and not any(token in search_blob for token in parsed["tokens"]) and not parsed["wants_attachments"]:
                continue

            matching_email_ids.add(email.gmail_id)
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
                    "type": attachment_type,
                }
            )

    attachments.sort(key=lambda item: (item["type"], item["name"].lower()))
    return attachments[:limit], matching_email_ids


def search_mail_context(user, queryset, query: str, limit: int = 8):
    parsed = _parse_query(query)
    scored = []

    for email in queryset:
        score, reasons = _score_email(email, parsed)
        if score > 0 or (not parsed["tokens"] and not parsed["sender_terms"] and not parsed["mailbox"]):
            scored.append((email, score, reasons))

    scored.sort(
        key=lambda item: (
            item[1],
            _get_prediction(item[0]).priority_score if _get_prediction(item[0]) else 0,
            item[0].internal_date or timezone.make_aware(datetime.min),
        ),
        reverse=True,
    )

    candidate_matches = scored[: max(limit * 5, 30)]
    attachments, attachment_email_ids = _collect_attachment_results(user, [item[0] for item in candidate_matches], parsed)

    if parsed["attachment_type"]:
        candidate_matches = [item for item in candidate_matches if item[0].gmail_id in attachment_email_ids]
    elif parsed["wants_attachments"] and attachment_email_ids:
        boosted = []
        for email, score, reasons in candidate_matches:
            if email.gmail_id in attachment_email_ids:
                boosted.append((email, score + 4, reasons + ["attachment-match"]))
            else:
                boosted.append((email, score, reasons))
        candidate_matches = boosted

    top_matches = candidate_matches[:limit]
    top_emails = [_serialize_email_result(email, score, reasons) for email, score, reasons in top_matches]

    task_results = []
    for email, score, reasons in candidate_matches[:limit]:
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

    return {
        "query": query,
        "matched_emails": top_emails,
        "related_attachments": attachments,
        "related_tasks": task_results[:8],
        "detected_context": {
            "intent": parsed["intent"],
            "urgency": parsed["urgency"],
            "mailbox": parsed["mailbox"],
            "sender_terms": parsed["sender_terms"],
            "wants_tasks": parsed["wants_tasks"],
            "wants_attachments": parsed["wants_attachments"],
            "attachment_type": parsed["attachment_type"],
            "date_from": parsed["date_from"].isoformat() if parsed["date_from"] else None,
        },
    }
