def calculate_priority_score(urgency: str | None, intent: str | None) -> int:
    score = 10

    if urgency == "High":
        score += 50
    elif urgency == "Medium":
        score += 25
    elif urgency == "Low":
        score += 5

    if intent in ["Verification", "Updates"]:
        score += 10
    elif intent in ["Promotions", "Spam"]:
        score -= 10
    elif intent in ["General", "Social"]:
        score += 0

    return max(0, min(100, score))
