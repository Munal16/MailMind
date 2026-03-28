from django.urls import path

from .google_auth import google_login_url
from .views import change_password, delete_account, me, notifications, register

urlpatterns = [
    path("register/", register),
    path("me/", me),
    path("change-password/", change_password),
    path("delete-account/", delete_account),
    path("notifications/", notifications),
    path("google/login-url/", google_login_url),
]
