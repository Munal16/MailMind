from django.db import models
from django.contrib.auth.models import User


class GmailCredential(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="gmail_accounts")
    email_address = models.EmailField(blank=True, default="")
    display_name = models.CharField(max_length=255, blank=True, default="")
    is_active = models.BooleanField(default=False)
    access_token = models.TextField(blank=True, null=True)
    refresh_token = models.TextField(blank=True, null=True)
    token_uri = models.TextField(blank=True, null=True)
    client_id = models.TextField(blank=True, null=True)
    client_secret = models.TextField(blank=True, null=True)
    scopes = models.TextField(blank=True, null=True)  # comma-separated
    expiry = models.DateTimeField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "email_address")

    def __str__(self):
        account_label = self.email_address or "unknown"
        return f"GmailCredential({self.user.username} - {account_label})"


class EmailMessage(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="emails")
    gmail_account = models.ForeignKey(
        GmailCredential,
        on_delete=models.SET_NULL,
        related_name="emails",
        null=True,
        blank=True,
    )
    source_email = models.EmailField(blank=True, default="", db_index=True)
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

    attachment_metadata = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "gmail_id", "source_email")

    def __str__(self):
        return f"{self.user.username} - {self.subject}"
