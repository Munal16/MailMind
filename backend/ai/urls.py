from django.urls import path

from .api import (
    ai_summary,
    analyze_email,
    analyze_latest_emails,
    contextual_search,
    list_tasks,
    priority_emails,
    update_task,
)

urlpatterns = [
    path("analyze/<str:gmail_id>/", analyze_email),
    path("analyze-latest/", analyze_latest_emails),
    path("tasks/", list_tasks),
    path("tasks/<int:task_id>/", update_task),
    path("priority-emails/", priority_emails),
    path("summary/", ai_summary),
    path("search/", contextual_search),
]
