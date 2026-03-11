from django.urls import path
from .gmail_oauth import gmail_auth_url, gmail_callback
from .api import gmail_status, gmail_sync, gmail_inbox, gmail_detail, smart_view
from .message_detail import gmail_message_detail
from .attachment_download import download_attachment

urlpatterns = [
    path("auth-url/", gmail_auth_url),
    path("callback/", gmail_callback),

    path("status/", gmail_status),
    path("sync/", gmail_sync),
    path("inbox/", gmail_inbox),

    path("message/<str:gmail_id>/", gmail_message_detail),
    path("attachment/<str:gmail_id>/<str:attachment_id>/", download_attachment),
    path("detail/<str:gmail_id>/", gmail_detail),
    path("smart/<str:view_type>/", smart_view),
]
