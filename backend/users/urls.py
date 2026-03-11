from django.urls import path
from .views import register, me

urlpatterns = [
    path("register/", register),
    path("me/", me),
]
