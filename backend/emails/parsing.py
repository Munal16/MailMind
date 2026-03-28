import base64
import binascii
import html
import re
from pathlib import Path


def get_header(headers, name):
    target = (name or "").lower()
    for header in headers or []:
        if (header.get("name") or "").lower() == target:
            return header.get("value")
    return None


def decode_b64url(data: str) -> str:
    if not data:
        return ""
    padding = "=" * (-len(data) % 4)
    try:
        raw = base64.urlsafe_b64decode((data + padding).encode("utf-8"))
        return raw.decode("utf-8", errors="replace")
    except (binascii.Error, ValueError):
        return ""


def html_to_text(value: str) -> str:
    text = str(value or "")
    if not text:
        return ""

    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", text)
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</p\s*>", "\n\n", text)
    text = re.sub(r"(?i)</div\s*>", "\n", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = html.unescape(text)
    text = text.replace("\r", " ")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\s+\n", "\n", text)
    return text.strip()


def find_part(payload: dict, mime_type: str):
    if not payload:
        return None

    if payload.get("mimeType") == mime_type and payload.get("body", {}).get("data"):
        return payload

    for part in payload.get("parts", []) or []:
        found = find_part(part, mime_type)
        if found:
            return found

    return None


def extract_body_text(payload: dict) -> str:
    if not payload:
        return ""

    text_part = find_part(payload, "text/plain")
    if text_part:
        return decode_b64url(text_part.get("body", {}).get("data", ""))

    mime_type = payload.get("mimeType", "")
    body_data = (payload.get("body") or {}).get("data")

    if mime_type == "text/plain" and body_data:
        return decode_b64url(body_data)

    if mime_type == "text/html" and body_data:
        return html_to_text(decode_b64url(body_data))

    for part in payload.get("parts", []) or []:
        text = extract_body_text(part)
        if text:
            return text

    if body_data:
        decoded = decode_b64url(body_data)
        if "<html" in decoded.lower() or "<body" in decoded.lower() or "<table" in decoded.lower():
            return html_to_text(decoded)
        return decoded

    return ""


def collect_attachments(payload: dict):
    attachments = []

    def collect(part):
        if not part:
            return

        filename = part.get("filename")
        body = part.get("body", {})
        attachment_id = body.get("attachmentId")
        mime_type = part.get("mimeType")
        size = body.get("size")

        if filename and attachment_id:
            attachments.append(
                {
                    "filename": filename,
                    "mime_type": mime_type,
                    "size": size,
                    "attachment_id": attachment_id,
                }
            )

        for child in part.get("parts", []) or []:
            collect(child)

    collect(payload)
    return attachments


def _clean_attachment_text(value: str) -> str:
    text = str(value or "")
    text = re.sub(r"^(re|fw|fwd):\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"[_\-]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def build_attachment_heading(filename: str, email_subject: str) -> str:
    filename_title = _clean_attachment_text(Path(filename or "").stem)
    subject_title = _clean_attachment_text(email_subject)

    if filename_title and subject_title:
        filename_lower = filename_title.lower()
        subject_lower = subject_title.lower()
        if filename_lower in subject_lower or subject_lower in filename_lower:
            return subject_title if len(subject_title) >= len(filename_title) else filename_title
        return f"{subject_title} - {filename_title}"

    return filename_title or subject_title or "Untitled attachment"


def infer_attachment_category(filename: str, mime_type: str):
    suffix = Path(filename or "").suffix.lower()
    mime_type = str(mime_type or "").lower()

    if "pdf" in mime_type or suffix == ".pdf":
        return "pdf"
    if mime_type.startswith("image/") or suffix in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".heic"}:
        return "image"
    if "spreadsheet" in mime_type or suffix in {".xls", ".xlsx", ".csv", ".ods"}:
        return "spreadsheet"
    if "presentation" in mime_type or suffix in {".ppt", ".pptx", ".key"}:
        return "presentation"
    if "word" in mime_type or "document" in mime_type or suffix in {".doc", ".docx", ".odt", ".rtf"}:
        return "doc"
    if mime_type.startswith("text/") or suffix in {".txt", ".md"}:
        return "text"
    if mime_type.startswith("audio/") or suffix in {".mp3", ".wav", ".m4a", ".aac"}:
        return "audio"
    if mime_type.startswith("video/") or suffix in {".mp4", ".mov", ".avi", ".mkv"}:
        return "video"
    if "zip" in mime_type or "compressed" in mime_type or suffix in {".zip", ".rar", ".7z", ".tar", ".gz"}:
        return "archive"
    return "other"


def infer_attachment_extension(filename: str):
    extension = Path(filename or "").suffix.lstrip(".").strip()
    return extension.upper() if extension else "FILE"
