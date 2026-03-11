from django.urls import path
from .api import summary

urlpatterns = [
    path("summary/", summary),
]
