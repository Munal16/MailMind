from django.contrib.auth.models import User
from django.db import models


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    job_title = models.CharField(max_length=120, blank=True, default="")
    profile_photo = models.FileField(upload_to="profile_photos/", blank=True, null=True)

    notify_urgent = models.BooleanField(default=True)
    notify_deadlines = models.BooleanField(default=True)
    notify_digest = models.BooleanField(default=False)
    notify_attachments = models.BooleanField(default=True)
    ai_sensitivity = models.CharField(max_length=20, default="Balanced")
    ai_auto_extraction = models.BooleanField(default=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"UserProfile({self.user.username})"
