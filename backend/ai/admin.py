from django.contrib import admin
from .models import EmailPrediction, ExtractedTask


@admin.register(EmailPrediction)
class EmailPredictionAdmin(admin.ModelAdmin):
    list_display  = ("user", "email", "urgency", "urgency_confidence", "intent", "intent_confidence", "priority_score")
    list_filter   = ("urgency", "intent")
    search_fields = ("user__username", "email__subject")


@admin.register(ExtractedTask)
class ExtractedTaskAdmin(admin.ModelAdmin):
    list_display  = ("user", "task_text", "confidence", "status", "deadline", "responsibility")
    list_filter   = ("status",)
    search_fields = ("user__username", "task_text")
