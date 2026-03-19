from django.urls import path

from .google_auth import google_login_url
from .views import register, me

urlpatterns = [
    path("register/", register),
    path("me/", me),
    path("google/login-url/", google_login_url),
]
