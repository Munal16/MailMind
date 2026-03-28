from django.urls import path

from .api import overview, set_admin_access


urlpatterns = [
    path("overview/", overview),
    path("users/<int:user_id>/access/", set_admin_access),
]
