from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from users.auth_views import MailMindTokenObtainPairView

urlpatterns = [
    path("", lambda request: JsonResponse({"message": "MailMind API is running"})),
    path("admin/", admin.site.urls),
    path("api/auth/login/", MailMindTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/users/", include("users.urls")),
    path("api/gmail/", include("emails.urls")),
    path("api/ai/", include("ai.urls")),
    path("api/admin/", include("adminpanel.urls")),
    path("api/analytics/", include("analyticsapp.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
