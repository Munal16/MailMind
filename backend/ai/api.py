from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from emails.models import EmailMessage
from .models import EmailPrediction
from .classifier import predict_email
from .ml_classifier import predict_with_ml


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def predict_one(request, gmail_id):
    email = EmailMessage.objects.filter(user=request.user, gmail_id=gmail_id).first()
    if not email:
        return Response({"error": "Email not found in DB. Sync first."}, status=404)

    try:
        pred_data = predict_with_ml(email.subject, email.snippet)
    except Exception:
        pred_data = predict_email(email.subject, email.sender, email.snippet)

    obj, _ = EmailPrediction.objects.update_or_create(
        user=request.user,
        email=email,
        defaults=pred_data,
    )

    return Response({
        "gmail_id": gmail_id,
        "prediction": {
            "urgency": obj.urgency,
            "intent": obj.intent,
            "priority_score": obj.priority_score,
            "explanation": obj.explanation,
        }
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def predict_batch(request):
    """
    Body: { "limit": 50 }  (optional)
    Predict for latest N emails stored in DB.
    """
    limit = int(request.data.get("limit", 50))

    emails = EmailMessage.objects.filter(user=request.user).order_by("-internal_date", "-created_at")[:limit]
    created = 0
    updated = 0

    for email in emails:
        try:
            pred_data = predict_with_ml(email.subject, email.snippet)
        except Exception:
            pred_data = predict_email(email.subject, email.sender, email.snippet)

        obj, is_created = EmailPrediction.objects.update_or_create(
            user=request.user,
            email=email,
            defaults=pred_data,
        )
        if is_created:
            created += 1
        else:
            updated += 1

    return Response({"limit": limit, "created": created, "updated": updated})
