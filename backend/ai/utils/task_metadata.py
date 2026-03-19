import re


DEADLINE_PATTERNS = [
    r"\b(?:today|tomorrow|tonight|asap|eod|eow|end of day|end of week|end of month|this week|next week|this month)\b",
    r"\b(?:by|before|on)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm))?\b",
    r"\b(?:by|before|on)\s+\d{1,2}/\d{1,2}(?:/\d{2,4})?\b",
    r"\b(?:by|before|on)\s+\d{4}-\d{2}-\d{2}\b",
    r"\b(?:by|before|on)\s+(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+\d{1,2}(?:,\s*\d{4})?\b",
    r"\b(?:at|by)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\b",
]

RESPONSIBILITY_PATTERNS = [
    re.compile(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:will|should|must|needs to|need to)\b"),
    re.compile(r"\bassign(?:ed)?\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b", re.IGNORECASE),
    re.compile(r"\bowner\s*[:\-]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b", re.IGNORECASE),
]


def extract_deadline_hint(text: str):
    content = str(text or "")
    for pattern in DEADLINE_PATTERNS:
        match = re.search(pattern, content, re.IGNORECASE)
        if match:
            return match.group(0).strip()
    return None


def extract_responsibility_hint(text: str):
    content = str(text or "")

    for pattern in RESPONSIBILITY_PATTERNS:
        match = pattern.search(content)
        if match:
            return match.group(1).strip()

    if re.search(r"\b(?:please|kindly|can you|could you|would you|you need to|you should|you must)\b", content, re.IGNORECASE):
        return "You"

    return None
