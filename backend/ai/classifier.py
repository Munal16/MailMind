import re


URGENT_KEYWORDS = [
    "urgent", "asap", "immediately", "deadline", "today", "overdue", "action required",
    "payment due", "final notice", "important", "required",
]

MEETING_KEYWORDS = ["meeting", "schedule", "reschedule", "call", "zoom", "google meet", "appointment"]
PAYMENT_KEYWORDS = ["invoice", "payment", "paid", "due", "bank", "receipt", "billing", "transaction"]
SUPPORT_KEYWORDS = ["issue", "problem", "support", "help", "error", "failed", "cannot", "unable"]
DELIVERY_KEYWORDS = ["delivery", "dispatch", "shipped", "tracking", "arrival", "courier"]


def _contains(text: str, keywords: list[str]) -> bool:
    t = (text or "").lower()
    return any(k in t for k in keywords)


def predict_email(subject: str, sender: str, snippet: str):
    """
    Baseline heuristic classifier.
    Replace later with ML model (same output format).
    """
    text = f"{subject or ''} {snippet or ''}"

    # Intent
    if _contains(text, MEETING_KEYWORDS):
        intent = "Meeting"
    elif _contains(text, PAYMENT_KEYWORDS):
        intent = "Payment"
    elif _contains(text, SUPPORT_KEYWORDS):
        intent = "Support"
    elif _contains(text, DELIVERY_KEYWORDS):
        intent = "Delivery"
    else:
        intent = "General"

    # Urgency
    if _contains(text, URGENT_KEYWORDS) or re.search(r"\b(today|tomorrow|now)\b", (text or "").lower()):
        urgency = "High"
    elif _contains(text, ["soon", "this week", "reminder"]):
        urgency = "Medium"
    else:
        urgency = "Low"

    # Priority score (0-100)
    score = 10
    if urgency == "High":
        score += 50
    elif urgency == "Medium":
        score += 25

    if intent in ["Payment", "Support"]:
        score += 20
    elif intent == "Meeting":
        score += 10

    score = max(0, min(100, score))

    explanation = f"Intent inferred from keywords; urgency inferred from urgency terms/date words. (baseline rules)"

    return {
        "urgency": urgency,
        "intent": intent,
        "priority_score": score,
        "explanation": explanation,
    }
