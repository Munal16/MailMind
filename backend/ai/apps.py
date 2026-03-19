from django.apps import AppConfig


class AiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "ai"

    def ready(self):
        # Keep startup fast; models are loaded lazily on first AI request.
        print("MailMind AI services ready. Models will load on first use.")
