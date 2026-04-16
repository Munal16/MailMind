from django.contrib import admin
from .models import EmailMessage, GmailCredential


@admin.register(GmailCredential)
class GmailCredentialAdmin(admin.ModelAdmin):
    list_display = ("user", "email_address", "is_active", "created_at")
    list_filter  = ("is_active",)
    search_fields = ("user__username", "email_address")


@admin.register(EmailMessage)
class EmailMessageAdmin(admin.ModelAdmin):
    list_display  = ("user", "subject", "sender", "source_email", "is_read", "is_starred", "internal_date")
    list_filter   = ("is_read", "is_starred")
    search_fields = ("subject", "sender", "user__username")
