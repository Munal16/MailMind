import re


def normalize_text(text: str) -> str:
    text = str(text or "")
    text = text.replace("\r", " ").replace("\n", " ").replace("\t", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def build_email_text(subject: str, body: str) -> str:
    subject = normalize_text(subject)
    body = normalize_text(body)
    return f"{subject} {body}".strip()
