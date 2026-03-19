from django.db import models
from django.contrib.auth.models import User
from emails.models import EmailMessage


class EmailPrediction(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="predictions")
    email = models.OneToOneField(EmailMessage, on_delete=models.CASCADE, related_name="prediction")

    urgency = models.CharField(max_length=20, blank=True, null=True)
    urgency_confidence = models.FloatField(blank=True, null=True)

    intent = models.CharField(max_length=50, blank=True, null=True)
    intent_confidence = models.FloatField(blank=True, null=True)

    priority_score = models.IntegerField(default=0)

    explanation = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.email.gmail_id}"


class ExtractedTask(models.Model):
    STATUS_CHOICES = [
        ("Pending", "Pending"),
        ("In Progress", "In Progress"),
        ("Completed", "Completed"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="extracted_tasks")
    email = models.ForeignKey(EmailMessage, on_delete=models.CASCADE, related_name="tasks")

    task_text = models.TextField()
    confidence = models.FloatField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Pending")
    deadline = models.CharField(max_length=100, blank=True, null=True)
    responsibility = models.CharField(max_length=255, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.task_text[:80]
