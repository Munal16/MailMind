from collections import Counter
import re

from ai.utils.sentence_utils import split_sentences
from ai.utils.text_preprocessing import normalize_text

STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "have",
    "if",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "this",
    "to",
    "was",
    "we",
    "with",
    "you",
    "your",
}

ACTION_HINT_RE = re.compile(
    r"\b(please|kindly|action|required|deadline|due|review|approve|send|share|complete|reply|confirm)\b",
    re.IGNORECASE,
)
NOISE_LINE_RE = re.compile(
    r"^(view in browser|shop now|learn more|click here|unsubscribe|privacy|terms|careers|update preferences|open in app)$",
    re.IGNORECASE,
)
URL_RE = re.compile(r"https?://|www\.|[a-z0-9-]+\.(com|org|net|io|app|co)(/|\b)", re.IGNORECASE)


def _tokenize(text: str):
    return [
        token
        for token in re.findall(r"[a-zA-Z][a-zA-Z0-9'-]+", text.lower())
        if len(token) > 2 and token not in STOP_WORDS
    ]


def _build_short_summary(subject: str, body_sentences, task_items):
    subject_text = normalize_text(subject)
    first_sentence = normalize_text(body_sentences[0] if body_sentences else "")
    lead_task = normalize_text(task_items[0] if task_items else "")

    parts = []

    if subject_text:
        parts.append(f'This email is about "{subject_text}".')
    elif first_sentence:
        parts.append(first_sentence)
    else:
        parts.append("This email is brief and does not include many extra details.")

    if first_sentence and subject_text and first_sentence.lower() not in subject_text.lower():
        parts.append(first_sentence)

    if lead_task:
        parts.append(f"Main action: {lead_task}.")
    elif subject_text and len(_tokenize(first_sentence or subject_text)) < 6:
        parts.append("It is a short message without many extra details.")

    summary = " ".join(parts)
    summary = re.sub(r"\s+", " ", summary).strip()
    return summary[:620]


def _is_useful_sentence(sentence: str) -> bool:
    clean_sentence = normalize_text(sentence)
    if not clean_sentence:
        return False

    tokens = _tokenize(clean_sentence)
    if len(tokens) < 4:
        return False

    lowered = clean_sentence.lower()
    if NOISE_LINE_RE.match(lowered):
        return False

    if URL_RE.search(clean_sentence) and len(tokens) < 10:
        return False

    if clean_sentence.count(">") >= 2 or clean_sentence.count("|") >= 3:
        return False

    return True


def summarize_email(subject: str, body: str, tasks=None) -> str:
    clean_subject = normalize_text(subject)
    clean_body = normalize_text(body)
    task_items = list(tasks or [])

    sentences = [sentence for sentence in split_sentences(clean_body) if _is_useful_sentence(sentence)]
    if not sentences:
        fallback = clean_subject or "No readable email body was available for summarization."
        if task_items:
            return f'This email is about "{fallback}". Main action: {task_items[0]}.'
        return f'This email is about "{fallback}".' if clean_subject else fallback

    short_token_count = len(_tokenize(clean_body))
    if short_token_count < 12:
        return _build_short_summary(clean_subject, sentences, task_items)

    keywords = Counter(_tokenize(f"{clean_subject} {' '.join(sentences[:6])}"))
    scored = []

    for index, sentence in enumerate(sentences[:18]):
        tokens = _tokenize(sentence)
        if not tokens:
            continue

        keyword_score = sum(keywords.get(token, 0) for token in set(tokens))
        position_bonus = max(0, 4 - index) * 1.1
        length_bonus = 1.0 if 8 <= len(tokens) <= 30 else 0.2
        action_bonus = 1.4 if ACTION_HINT_RE.search(sentence) else 0
        score = keyword_score + position_bonus + length_bonus + action_bonus
        scored.append((score, index, sentence))

    if not scored:
        summary = clean_subject or sentences[0]
    else:
        chosen = sorted(scored, key=lambda item: (-item[0], item[1]))[:2]
        chosen = [item[2] for item in sorted(chosen, key=lambda item: item[1])]
        summary = " ".join(chosen)

    if clean_subject and clean_subject.lower() not in summary.lower():
        summary = f"{clean_subject}. {summary}"

    if task_items:
        lead_task = normalize_text(task_items[0])
        if lead_task and lead_task.lower() not in summary.lower():
            summary = f"{summary} Main action: {lead_task}."

    if len(_tokenize(summary)) < 10:
        summary = _build_short_summary(clean_subject, sentences, task_items)

    summary = re.sub(r"\s+", " ", summary).strip()
    return summary[:620]
