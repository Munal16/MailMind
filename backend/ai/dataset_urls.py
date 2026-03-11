from django.urls import path
from .dataset_api import dataset_status, upload_dataset

urlpatterns = [
    path("status/", dataset_status),
    path("upload/", upload_dataset),
]
