from django.db import models
from django.contrib.auth.models import User


class GmailCredential(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="gmail_cred")
    access_token = models.TextField(blank=True, null=True)
    refresh_token = models.TextField(blank=True, null=True)
    token_uri = models.TextField(blank=True, null=True)
    client_id = models.TextField(blank=True, null=True)
    client_secret = models.TextField(blank=True, null=True)
    scopes = models.TextField(blank=True, null=True)  # comma-separated
    expiry = models.DateTimeField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"GmailCredential({self.user.username})"


class EmailMessage(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="emails")
    gmail_id = models.CharField(max_length=128, db_index=True)  # Gmail message id
    thread_id = models.CharField(max_length=128, blank=True, null=True)
    subject = models.TextField(blank=True, null=True)
    sender = models.TextField(blank=True, null=True)
    snippet = models.TextField(blank=True, null=True)
    full_body_text = models.TextField(blank=True, null=True)
    project_name = models.CharField(max_length=255, blank=True, null=True)

    # Use Gmail "internalDate" (ms since epoch)
    internal_date = models.DateTimeField(blank=True, null=True)

    # Store labels as comma-separated (simple for now)
    labels = models.TextField(blank=True, null=True)

    # Basic status flags (we'll use later for AI/filters)
    is_read = models.BooleanField(default=False)
    is_starred = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "gmail_id")

    def __str__(self):
        return f"{self.user.username} - {self.subject}"
