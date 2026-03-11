from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("", lambda request: JsonResponse({"message": "MailMind API is running"})),
    path("admin/", admin.site.urls),
    path("api/auth/login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/users/", include("users.urls")),
    path("api/gmail/", include("emails.urls")),
    path("api/ai/", include("ai.urls")),
    path("api/ai/admin/", include("ai.admin_urls")),
    path("api/ai/dataset/", include("ai.dataset_urls")),
    path("api/analytics/", include("analyticsapp.urls")),
]
