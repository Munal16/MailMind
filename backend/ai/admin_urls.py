from django.urls import path
from .admin_api import model_metrics, retrain_models

urlpatterns = [
    path("metrics/", model_metrics),
    path("retrain/", retrain_models),
]
