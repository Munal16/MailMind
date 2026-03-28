from django.urls import path
from .gmail_oauth import gmail_auth_url, gmail_callback
from .api import (
    gmail_status,
    gmail_disconnect,
    gmail_sync,
    gmail_send_message,
    gmail_save_draft,
    gmail_inbox,
    gmail_detail,
    gmail_attachments,
    gmail_trash_message,
    gmail_restore_message,
    gmail_empty_trash,
    smart_view,
)
from .message_detail import gmail_message_detail
from .attachment_download import download_attachment

urlpatterns = [
    path("auth-url/", gmail_auth_url),
    path("callback/", gmail_callback),

    path("status/", gmail_status),
    path("disconnect/", gmail_disconnect),
    path("sync/", gmail_sync),
    path("send/", gmail_send_message),
    path("drafts/save/", gmail_save_draft),
    path("inbox/", gmail_inbox),
    path("attachments/", gmail_attachments),
    path("message/<str:gmail_id>/trash/", gmail_trash_message),
    path("message/<str:gmail_id>/restore/", gmail_restore_message),
    path("trash/empty/", gmail_empty_trash),

    path("message/<str:gmail_id>/", gmail_message_detail),
    path("attachment/<str:gmail_id>/<str:attachment_id>/", download_attachment),
    path("detail/<str:gmail_id>/", gmail_detail),
    path("smart/<str:view_type>/", smart_view),
]
