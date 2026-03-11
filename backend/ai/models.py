from django.db import models
from django.contrib.auth.models import User
from emails.models import EmailMessage


class EmailPrediction(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="predictions")
    email = models.OneToOneField(EmailMessage, on_delete=models.CASCADE, related_name="prediction")

    urgency = models.CharField(max_length=20)   # Low/Medium/High
    intent = models.CharField(max_length=50)    # Meeting/Payment/Support/etc
    priority_score = models.IntegerField(default=0)  # 0-100

    explanation = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.urgency} - {self.intent}"
