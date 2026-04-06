import re
from datetime import datetime, timedelta
from difflib import SequenceMatcher

from django.utils import timezone
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel

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
    "without",
    "by",
    "from",
    "sent",
    "attached",
    "about",
    "related",
    "for",
    "of",
    "in",
}

NEGATIVE_ATTACHMENT_PATTERNS = [
    re.compile(r"\bwithout\s+(?:any\s+)?(?:attachments?|files?|documents?|images?|photos?|pdfs?|docs?)\b", re.IGNORECASE),
    re.compile(r"\bno\s+(?:attachments?|files?|documents?|images?|photos?|pdfs?|docs?)\b", re.IGNORECASE),
    re.compile(r"\b(?:excluding|exclude)\s+(?:attachments?|files?|documents?|images?|photos?|pdfs?|docs?)\b", re.IGNORECASE),
    re.compile(r"\b(?:don'?t|do not|doesn'?t|does not|didn'?t|did not)\s+have\s+(?:any\s+)?(?:attachments?|files?|documents?|images?|photos?|pdfs?|docs?)\b", re.IGNORECASE),
    re.compile(r"\b(?:lacking|lack|lacks|missing)\s+(?:attachments?|files?|documents?|images?|photos?|pdfs?|docs?)\b", re.IGNORECASE),
]

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

MAILBOX_HINT_PATTERNS = [
    (re.compile(r"\bunread\b", re.IGNORECASE), "unread"),
    (re.compile(r"\bstarred\b", re.IGNORECASE), "starred"),
    (
        re.compile(
            r"\b(?:sent\s+(?:emails?|mail|messages?|folder|mailbox)|(?:emails?|mail|messages?)\s+sent(?!\s+by\b))\b",
            re.IGNORECASE,
        ),
        "sent",
    ),
    (re.compile(r"\bdrafts?\b", re.IGNORECASE), "drafts"),
    (re.compile(r"\barchiv(?:e|ed)\b", re.IGNORECASE), "archive"),
    (re.compile(r"\b(?:trash|deleted)\b", re.IGNORECASE), "trash"),
    (re.compile(r"\b(?:priority|urgent)\b", re.IGNORECASE), "priority"),
]

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

ATTACHMENT_QUERY_TOKENS = {
    "attachment",
    "attachments",
    "file",
    "files",
    "document",
    "documents",
    "image",
    "images",
    "photo",
    "photos",
    "attached",
    "attachmentless",
    "pdf",
    "pdfs",
    "doc",
    "docs",
    "docx",
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
    for pattern, mailbox in MAILBOX_HINT_PATTERNS:
        if pattern.search(text):
            return mailbox
    return None


def _detect_attachment_constraint(text: str):
    if any(pattern.search(text) for pattern in NEGATIVE_ATTACHMENT_PATTERNS):
        return "without"

    positive_patterns = [
        re.compile(r"\bwith\s+(?:any\s+)?(?:attachments?|files?|documents?|images?|photos?|pdfs?|docs?)\b", re.IGNORECASE),
        re.compile(r"\b(?:has|having|include|includes|including|contains|containing)\s+(?:any\s+)?(?:attachments?|files?|documents?|images?|photos?|pdfs?|docs?)\b", re.IGNORECASE),
    ]
    if any(pattern.search(text) for pattern in positive_patterns):
        return "with"

    if any(keyword in text for keyword in ["attachment", "attachments", "file", "files", "document", "documents", "image", "images", "pdf", "doc"]):
        return "with"

    return None


def _sender_candidates(raw_sender: str):
    normalized = normalize_text(raw_sender).lower()
    normalized = normalized.replace("<", " ").replace(">", " ").replace("@", " ").replace(".", " ").replace("_", " ").replace("-", " ")
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if not normalized:
        return set()

    parts = {part for part in normalized.split() if len(part) > 1}
    compact = normalized.replace(" ", "")
    if len(compact) > 1:
        parts.add(compact)
    return parts


def _matches_sender_terms(raw_sender: str, sender_terms):
    candidates = _sender_candidates(raw_sender)
    if not candidates:
        return False

    for sender_term in sender_terms:
        cleaned_term = normalize_text(sender_term).lower().strip()
        if not cleaned_term:
            continue

        compact_term = cleaned_term.replace(" ", "")
        if compact_term and any(compact_term in candidate for candidate in candidates):
            return True

        for term_part in cleaned_term.split():
            if term_part in candidates:
                return True

            if any(
                SequenceMatcher(None, term_part, candidate).ratio() >= 0.82
                for candidate in candidates
                if abs(len(candidate) - len(term_part)) <= 4
            ):
                return True

    return False


def _parse_query(query: str):
    text = normalize_text(query).lower()
    sender_terms = _parse_sender_terms(text)

    tokens = [token for token in re.findall(r"[a-z0-9#@._/-]+", text) if token not in STOPWORDS]
    for sender_term in sender_terms:
        tokens = [token for token in tokens if token not in sender_term.split()]

    wants_tasks = any(keyword in text for keyword in ["task", "tasks", "action", "todo", "follow up", "follow-up", "deadline"])
    attachment_constraint = _detect_attachment_constraint(text)
    without_attachments = attachment_constraint == "without"
    wants_attachments = attachment_constraint == "with"

    if wants_attachments or without_attachments:
        tokens = [token for token in tokens if token not in ATTACHMENT_QUERY_TOKENS]

    attachment_type = None if without_attachments else _detect_attachment_type(text)
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
        "without_attachments": without_attachments,
        "attachment_type": attachment_type,
        "date_from": date_from,
        "sender_terms": sender_terms,
        "mailbox": mailbox,
    }


def _has_search_constraints(parsed):
    return any(
        [
            bool(parsed["tokens"]),
            bool(parsed["intent"]),
            bool(parsed["urgency"]),
            bool(parsed["wants_tasks"]),
            bool(parsed["wants_attachments"]),
            bool(parsed["without_attachments"]),
            bool(parsed["attachment_type"]),
            bool(parsed["date_from"]),
            bool(parsed["sender_terms"]),
            bool(parsed["mailbox"]),
        ]
    )


def _label_search_terms(email):
    labels = _label_set(email)
    terms = []
    if "UNREAD" in labels:
        terms.append("unread")
    if "STARRED" in labels:
        terms.append("starred")
    if "SENT" in labels:
        terms.extend(["sent", "sent mailbox"])
    if "DRAFT" in labels:
        terms.extend(["draft", "drafts"])
    if "TRASH" in labels:
        terms.extend(["trash", "deleted"])
    if "INBOX" not in labels and "SENT" not in labels and "DRAFT" not in labels and "TRASH" not in labels:
        terms.extend(["archive", "archived"])
    if "HAS_ATTACHMENT" in labels:
        terms.extend(["attachment", "attachments", "file", "files"])
    return " ".join(terms)


def _email_task_blob(email):
    return " ".join(normalize_text(task.task_text).lower() for task in email.tasks.all())


def _build_email_search_document(email):
    prediction = _get_prediction(email)
    parts = [
        normalize_text(email.subject).lower(),
        normalize_text(email.sender).lower(),
        " ".join(sorted(_sender_candidates(email.sender))),
        normalize_text(email.snippet).lower(),
        normalize_text(email.full_body_text).lower(),
        normalize_text(getattr(email, "project_name", "")).lower(),
        _label_search_terms(email),
        _email_task_blob(email),
    ]

    if prediction:
        parts.extend(
            [
                normalize_text(prediction.urgency).lower(),
                normalize_text(prediction.intent).lower(),
            ]
        )

    return " ".join(part for part in parts if part).strip()


def _build_query_search_text(parsed):
    parts = []
    parts.extend(parsed["sender_terms"])
    parts.extend(parsed["tokens"])

    if parsed["intent"]:
        parts.append(parsed["intent"])
    if parsed["urgency"]:
        parts.append(parsed["urgency"])
    if parsed["mailbox"]:
        parts.append(parsed["mailbox"])
    if parsed["wants_tasks"]:
        parts.extend(["task", "action", "deadline"])
    if parsed["wants_attachments"]:
        parts.append(parsed["attachment_type"] or "attachments")
    if parsed["without_attachments"]:
        parts.append("without attachments")

    query_text = " ".join(part for part in parts if part).strip()
    return query_text or parsed["raw"]


def _semantic_email_scores(emails, parsed):
    if not emails:
        return {}

    query_text = _build_query_search_text(parsed)
    documents = [_build_email_search_document(email) for email in emails]

    try:
        word_vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=12000)
        word_matrix = word_vectorizer.fit_transform([query_text, *documents])
        word_scores = linear_kernel(word_matrix[0:1], word_matrix[1:]).flatten()
    except ValueError:
        word_scores = [0.0] * len(emails)

    try:
        char_vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), max_features=6000)
        char_matrix = char_vectorizer.fit_transform([query_text, *documents])
        char_scores = linear_kernel(char_matrix[0:1], char_matrix[1:]).flatten()
    except ValueError:
        char_scores = [0.0] * len(emails)

    return {
        email.gmail_id: float((word_score * 0.72) + (char_score * 0.28))
        for email, word_score, char_score in zip(emails, word_scores, char_scores)
    }


def _score_email(email, parsed, semantic_score=0.0):
    if parsed["date_from"] and email.internal_date and email.internal_date < parsed["date_from"]:
        return 0, []

    if parsed["mailbox"] and not _email_matches_mailbox(email, parsed["mailbox"]):
        return 0, []

    score = semantic_score * 42
    reasons = []

    subject = normalize_text(email.subject).lower()
    sender = normalize_text(email.sender).lower()
    snippet = normalize_text(email.snippet).lower()
    body = normalize_text(email.full_body_text).lower()
    project_name = normalize_text(getattr(email, "project_name", "")).lower()
    task_text = _email_task_blob(email)
    combined = f"{subject} {sender} {snippet} {body} {project_name} {task_text}"

    haystacks = [
        (subject, 8, "subject"),
        (project_name, 7, "project"),
        (sender, 10, "sender"),
        (snippet, 5, "snippet"),
        (body, 4, "body"),
        (task_text, 9, "task"),
    ]

    if semantic_score >= 0.08:
        reasons.append("semantic")

    if parsed["raw"] and len(parsed["raw"]) > 4 and parsed["raw"] in combined:
        score += 12
        reasons.append("phrase")

    if parsed["sender_terms"]:
        if _matches_sender_terms(email.sender, parsed["sender_terms"]):
            score += 20
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
        score += 10
        reasons.append("intent")

    if parsed["urgency"] and prediction and prediction.urgency == parsed["urgency"]:
        score += 10
        reasons.append("urgency")

    if parsed["wants_tasks"] and email.tasks.exists():
        score += 8
        reasons.append("tasks")

    if parsed["without_attachments"]:
        if _has_attachment(email):
            return 0, []
        score += 10
        reasons.append("without-attachments")
    elif parsed["wants_attachments"] or parsed["attachment_type"]:
        if _has_attachment(email):
            score += 10
            reasons.append("attachments")
        else:
            return 0, []

    if parsed["tokens"] and task_text:
        matched_task_tokens = [token for token in parsed["tokens"] if token and token in task_text]
        if matched_task_tokens:
            score += 8 + min(len(matched_task_tokens), 3) * 2
            reasons.append("task-match")

    if parsed["date_from"] and email.internal_date and email.internal_date >= parsed["date_from"]:
        score += 4
        reasons.append("date")

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
    if parsed["without_attachments"]:
        return attachments, matching_email_ids

    candidate_emails = [email for email in emails if _has_attachment(email)]

    if not candidate_emails:
        return attachments, matching_email_ids

    inspection_limit = 150 if (parsed["wants_attachments"] or parsed["attachment_type"]) else 60
    for email in candidate_emails[:inspection_limit]:
        try:
            service = get_gmail_service(user, credential=email.gmail_account)
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
                    "source_email": getattr(email, "source_email", ""),
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
    has_constraints = _has_search_constraints(parsed)
    emails = list(queryset)
    semantic_scores = _semantic_email_scores(emails, parsed)
    scored = []

    for email in emails:
        score, reasons = _score_email(email, parsed, semantic_scores.get(email.gmail_id, 0.0))
        if score > 0 or not has_constraints:
            scored.append((email, score, reasons))

    scored.sort(
        key=lambda item: (
            item[1],
            _get_prediction(item[0]).priority_score if _get_prediction(item[0]) else 0,
            item[0].internal_date or timezone.make_aware(datetime.min),
        ),
        reverse=True,
    )

    attachment_source = emails if (parsed["wants_attachments"] or parsed["attachment_type"]) else [item[0] for item in scored[: max(limit * 6, 60)]]
    attachments, attachment_email_ids = _collect_attachment_results(user, attachment_source, parsed)
    candidate_matches = scored[: max(limit * 6, 60)]

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

    # Build suggestions: top results by semantic score when main results are empty or weak
    suggestions = []
    if not top_emails and has_constraints:
        semantic_top = sorted(
            emails,
            key=lambda e: semantic_scores.get(e.gmail_id, 0.0),
            reverse=True,
        )[:3]
        for email in semantic_top:
            sem_score = semantic_scores.get(email.gmail_id, 0.0)
            if sem_score > 0.01:
                suggestions.append({
                    "gmail_id": email.gmail_id,
                    "subject": email.subject,
                    "sender": email.sender,
                    "snippet": email.snippet,
                    "internal_date": email.internal_date.isoformat() if email.internal_date else None,
                })

    return {
        "query": query,
        "matched_emails": top_emails,
        "related_attachments": attachments,
        "related_tasks": task_results[:8],
        "suggestions": suggestions,
        "detected_context": {
            "intent": parsed["intent"],
            "urgency": parsed["urgency"],
            "mailbox": parsed["mailbox"],
            "sender_terms": parsed["sender_terms"],
            "wants_tasks": parsed["wants_tasks"],
            "wants_attachments": parsed["wants_attachments"],
            "without_attachments": parsed["without_attachments"],
            "attachment_type": parsed["attachment_type"],
            "date_from": parsed["date_from"].isoformat() if parsed["date_from"] else None,
        },
    }
