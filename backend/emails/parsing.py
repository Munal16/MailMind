import base64
import binascii


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

    for part in payload.get("parts", []) or []:
        text = extract_body_text(part)
        if text:
            return text

    if mime_type == "text/html" and body_data:
        return decode_b64url(body_data)

    if body_data:
        return decode_b64url(body_data)

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
