import re
from datetime import datetime
from html import unescape


RELATIVE_DEADLINES = [
    (re.compile(r"\b(asap|urgent|immediately)\b", re.IGNORECASE), "ASAP"),
    (re.compile(r"\b(today)\b", re.IGNORECASE), "Today"),
    (re.compile(r"\b(tomorrow)\b", re.IGNORECASE), "Tomorrow"),
    (re.compile(r"\b(tonight)\b", re.IGNORECASE), "Tonight"),
    (re.compile(r"\b(eod|end of day)\b", re.IGNORECASE), "End of day"),
    (re.compile(r"\b(eow|end of week)\b", re.IGNORECASE), "End of week"),
    (re.compile(r"\b(end of month)\b", re.IGNORECASE), "End of month"),
    (re.compile(r"\b(this week)\b", re.IGNORECASE), "This week"),
    (re.compile(r"\b(next week)\b", re.IGNORECASE), "Next week"),
    (re.compile(r"\b(this month)\b", re.IGNORECASE), "This month"),
    (re.compile(r"\b(next month)\b", re.IGNORECASE), "Next month"),
]

WEEKDAY_PATTERN = re.compile(
    r"\b(?:by|before|on)\s+"
    r"(monday|tuesday|wednesday|thursday|friday|saturday|sunday)"
    r"(?:\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?\b",
    re.IGNORECASE,
)

MONTH_DATE_PATTERN = re.compile(
    r"\b(?:by|before|on)?\s*"
    r"("
    r"(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)"
    r"\s+\d{1,2}(?:,\s*\d{4})?"
    r"(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm))?"
    r")\b",
    re.IGNORECASE,
)

NUMERIC_DATE_PATTERN = re.compile(
    r"\b(?:by|before|on)?\s*(\d{1,2}/\d{1,2}(?:/\d{2,4})?)(?:\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?\b",
    re.IGNORECASE,
)

ISO_DATE_PATTERN = re.compile(
    r"\b(?:by|before|on)?\s*(\d{4}-\d{2}-\d{2})(?:\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?\b",
    re.IGNORECASE,
)

TIME_ONLY_PATTERN = re.compile(r"\b(?:by|before|at)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b", re.IGNORECASE)

NAME_FRAGMENT = r"([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){0,2})"
ROLE_FRAGMENT = r"([A-Za-z][A-Za-z&/\- ]{2,40}(?:team|desk|manager|lead|owner|coordinator|admin|support))"
EMAIL_PATTERN = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)

RESPONSIBILITY_PATTERNS = [
    re.compile(rf"\bassign(?:ed)?\s+to\s+{NAME_FRAGMENT}\b", re.IGNORECASE),
    re.compile(rf"\bowner\s*[:\-]\s*{NAME_FRAGMENT}\b", re.IGNORECASE),
    re.compile(rf"\bresponsible(?:\s+person)?\s*[:\-]\s*{NAME_FRAGMENT}\b", re.IGNORECASE),
    re.compile(rf"\bhandled\s+by\s+{NAME_FRAGMENT}\b", re.IGNORECASE),
    re.compile(rf"\bfor\s+{NAME_FRAGMENT}\s+to\b", re.IGNORECASE),
    re.compile(rf"\bplease\s+{NAME_FRAGMENT}\b"),
    re.compile(rf"\b{NAME_FRAGMENT}\s+(?:will|should|must|needs to|need to|can|has to|is to)\b"),
    re.compile(rf"\bassign(?:ed)?\s+to\s+{ROLE_FRAGMENT}\b", re.IGNORECASE),
    re.compile(rf"\bowner\s*[:\-]\s*{ROLE_FRAGMENT}\b", re.IGNORECASE),
]

SECOND_PERSON_PATTERN = re.compile(
    r"\b(?:please|kindly|can you|could you|would you|you need to|you should|you must|remember to|make sure you)\b",
    re.IGNORECASE,
)


def _clean_text(value: str) -> str:
    text = unescape(str(value or ""))
    text = text.replace("\r", " ").replace("\n", " ").replace("\t", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _format_time_fragment(value: str) -> str:
    cleaned = re.sub(r"\s+", " ", str(value or "")).strip().upper()
    cleaned = cleaned.replace("AM", " AM").replace("PM", " PM")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _title_case_fragment(value: str) -> str:
    text = _clean_text(value)
    return " ".join(part.capitalize() if part.isalpha() else part for part in text.split())


def _normalize_date_string(value: str) -> str:
    raw = _clean_text(value)
    for pattern in ("%m/%d/%Y", "%m/%d/%y", "%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, pattern).strftime("%b %d, %Y")
        except ValueError:
            continue
    return raw


def extract_deadline_hint(text: str):
    content = _clean_text(text)
    if not content:
        return None

    for pattern, label in RELATIVE_DEADLINES:
        if pattern.search(content):
            return label

    weekday_match = WEEKDAY_PATTERN.search(content)
    if weekday_match:
        weekday = _title_case_fragment(weekday_match.group(1))
        time_fragment = weekday_match.group(2)
        return f"By {weekday}{f' at {_format_time_fragment(time_fragment)}' if time_fragment else ''}"

    month_date_match = MONTH_DATE_PATTERN.search(content)
    if month_date_match:
        return _title_case_fragment(month_date_match.group(1))

    numeric_date_match = NUMERIC_DATE_PATTERN.search(content)
    if numeric_date_match:
        date_part = _normalize_date_string(numeric_date_match.group(1))
        time_fragment = numeric_date_match.group(2)
        return f"{date_part}{f' at {_format_time_fragment(time_fragment)}' if time_fragment else ''}"

    iso_date_match = ISO_DATE_PATTERN.search(content)
    if iso_date_match:
        date_part = _normalize_date_string(iso_date_match.group(1))
        time_fragment = iso_date_match.group(2)
        return f"{date_part}{f' at {_format_time_fragment(time_fragment)}' if time_fragment else ''}"

    time_only_match = TIME_ONLY_PATTERN.search(content)
    if time_only_match:
        return f"By {_format_time_fragment(time_only_match.group(1))}"

    return None


def _extract_sender_name(sender: str | None):
    raw_sender = _clean_text(sender)
    if not raw_sender:
        return None

    match = re.match(r"^(.*?)(?:\s*<[^>]+>)?$", raw_sender)
    name = _clean_text(match.group(1) if match else raw_sender)
    if not name or "@" in name:
        return None
    return name


def extract_responsibility_hint(text: str, *, sender: str | None = None):
    content = _clean_text(text)
    if not content:
        return None

    for pattern in RESPONSIBILITY_PATTERNS:
        match = pattern.search(content)
        if match:
            return _title_case_fragment(match.group(1))

    email_match = EMAIL_PATTERN.search(content)
    if email_match and any(keyword in content.lower() for keyword in ["contact", "reach", "owner", "assigned"]):
        return email_match.group(0).lower()

    if SECOND_PERSON_PATTERN.search(content):
        return "You"

    lowered = content.lower()
    sender_name = _extract_sender_name(sender)
    if sender_name and any(phrase in lowered for phrase in ["i will", "we will", "our team will", "i can", "we can"]):
        return sender_name

    return None
