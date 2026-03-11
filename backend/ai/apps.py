from django.apps import AppConfig


class AiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "ai"

    def ready(self):
        try:
            from .ml_classifier import load_models
            load_models()
        except Exception as e:
            print("ML models not loaded:", e)
