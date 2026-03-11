from collections import Counter

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from emails.models import EmailMessage
from ai.models import EmailPrediction


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def summary(request):
    user = request.user

    total_emails = EmailMessage.objects.filter(user=user).count()
    total_pred = EmailPrediction.objects.filter(user=user).count()

    # Urgency + intent counts from predictions
    urgencies = list(EmailPrediction.objects.filter(user=user).values_list("urgency", flat=True))
    intents = list(EmailPrediction.objects.filter(user=user).values_list("intent", flat=True))
    scores = list(EmailPrediction.objects.filter(user=user).values_list("priority_score", flat=True))

    urgency_counts = Counter(urgencies)
    intent_counts = Counter(intents)

    high_urgency = urgency_counts.get("High", 0)
    medium_urgency = urgency_counts.get("Medium", 0)
    low_urgency = urgency_counts.get("Low", 0)

    top_intent = intent_counts.most_common(1)[0][0] if intent_counts else None
    avg_priority = round(sum(scores) / len(scores), 2) if scores else 0

    # High priority list (top 10)
    high_priority = (
        EmailPrediction.objects.filter(user=user)
        .select_related("email")
        .order_by("-priority_score", "-created_at")[:10]
    )

    high_priority_list = []
    for p in high_priority:
        e = p.email
        high_priority_list.append(
            {
                "gmail_id": e.gmail_id,
                "subject": e.subject,
                "sender": e.sender,
                "snippet": e.snippet,
                "internal_date": e.internal_date.isoformat() if e.internal_date else None,
                "urgency": p.urgency,
                "intent": p.intent,
                "priority_score": p.priority_score,
            }
        )

    return Response(
        {
            "kpis": {
                "total_emails": total_emails,
                "total_predicted": total_pred,
                "high_urgency": high_urgency,
                "avg_priority": avg_priority,
                "top_intent": top_intent,
            },
            "charts": {
                "urgency": {
                    "labels": ["High", "Medium", "Low"],
                    "values": [high_urgency, medium_urgency, low_urgency],
                },
                "intent": {
                    "labels": [k for k, _ in intent_counts.most_common(10)],
                    "values": [v for _, v in intent_counts.most_common(10)],
                },
            },
            "high_priority": high_priority_list,
        }
    )
