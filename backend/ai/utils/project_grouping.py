import re

from ai.utils.text_preprocessing import normalize_text


GENERIC_SUBJECT_PARTS = {
    "re",
    "fwd",
    "fw",
    "urgent",
    "action required",
    "please review",
    "update",
    "status update",
    "meeting notes",
    "verification code",
    "account verification",
    "payment due",
}


def _clean_candidate(candidate: str):
    candidate = normalize_text(candidate)
    candidate = re.sub(r"^(?:re|fwd|fw)\s*[:\-]\s*", "", candidate, flags=re.IGNORECASE)
    candidate = re.sub(r"\s+", " ", candidate).strip(" -:|")
    return candidate


def _looks_like_project(candidate: str):
    if not candidate:
        return False

    normalized = candidate.lower()
    if normalized in GENERIC_SUBJECT_PARTS:
        return False

    words = [word for word in re.split(r"\s+", candidate) if word]
    if len(words) >= 2:
        return True

    return bool(re.search(r"[A-Z]{2,}|\d", candidate))


def infer_project_name(subject: str, body: str):
    subject_text = _clean_candidate(subject)
    body_text = normalize_text(body)

    subject_segments = re.split(r"\s*[:\-|]\s*", subject_text)
    for segment in subject_segments:
        candidate = _clean_candidate(segment)
        if _looks_like_project(candidate):
            return candidate[:120]

    project_patterns = [
        r"\bproject\s+([A-Z0-9][A-Za-z0-9&/#.\-]*(?:\s+[A-Z0-9][A-Za-z0-9&/#.\-]*){0,3})",
        r"\b(?:initiative|program|campaign|sprint|release|phase)\s+([A-Z0-9][A-Za-z0-9&/#.\-]*(?:\s+[A-Z0-9][A-Za-z0-9&/#.\-]*){0,3})",
    ]

    for pattern in project_patterns:
        match = re.search(pattern, body_text, re.IGNORECASE)
        if match:
            candidate = _clean_candidate(match.group(1))
            if _looks_like_project(candidate):
                return candidate[:120]

    title_case_runs = re.findall(r"\b(?:[A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){1,3})\b", subject_text)
    for run in title_case_runs:
        candidate = _clean_candidate(run)
        if _looks_like_project(candidate):
            return candidate[:120]

    return None
