import re


def split_sentences(text: str):
    text = str(text or "")
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return [sentence.strip() for sentence in sentences if sentence.strip()]
