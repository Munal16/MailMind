import re


WHITESPACE_RE = re.compile(r"\s+")

TASK_NOISE_PATTERNS = [
    re.compile(r"not (?:the )?intended recipient", re.IGNORECASE),
    re.compile(r"unauthorized review", re.IGNORECASE),
    re.compile(r"distribution is prohibited", re.IGNORECASE),
    re.compile(r"disclosure by others is strictly prohibited", re.IGNORECASE),
    re.compile(r"destroy all copies", re.IGNORECASE),
    re.compile(r"copy or deliver this message", re.IGNORECASE),
    re.compile(r"strictly prohibited", re.IGNORECASE),
    re.compile(r"\bunsubscribe\b", re.IGNORECASE),
    re.compile(r"stop receiving", re.IGNORECASE),
    re.compile(r'word\s+"?remove"?\s+in the subject line', re.IGNORECASE),
    re.compile(r"contact the sender", re.IGNORECASE),
    re.compile(r"call me if you have any questions", re.IGNORECASE),
    re.compile(r"please call if you have any questions", re.IGNORECASE),
    re.compile(r"let us know if you have any questions", re.IGNORECASE),
]


def normalize_task_text(text: str) -> str:
    value = str(text or "").strip()
    value = WHITESPACE_RE.sub(" ", value)
    return value


def task_word_count(text: str) -> int:
    return len(normalize_task_text(text).split())


def is_task_noise(text: str) -> bool:
    value = normalize_task_text(text)
    if not value:
        return True

    word_count = task_word_count(value)
    if word_count < 3:
        return True
    if word_count > 80:
        return True

    lowered = value.lower()
    if lowered.startswith("http://") or lowered.startswith("https://"):
        return True

    return any(pattern.search(value) for pattern in TASK_NOISE_PATTERNS)
