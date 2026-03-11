from django.urls import path
from .api import predict_one, predict_batch

urlpatterns = [
    path("predict/<str:gmail_id>/", predict_one),
    path("predict-batch/", predict_batch),
]
