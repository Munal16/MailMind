from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db.models import Q
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from ai.models import EmailPrediction, ExtractedTask
from emails.models import EmailMessage, GmailCredential

from .models import UserProfile
from .serializers import RegisterSerializer


def get_profile(user):
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return profile


def profile_photo_url(request, profile):
    if not profile.profile_photo:
        return None
    return request.build_absolute_uri(profile.profile_photo.url)


def serialize_profile(request, user, profile):
    connected_gmail_accounts = GmailCredential.objects.filter(user=user, refresh_token__isnull=False).count()
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "job_title": profile.job_title or "",
        "profile_photo_url": profile_photo_url(request, profile),
        "connected_gmail_accounts": connected_gmail_accounts,
        "notification_preferences": {
            "urgent": profile.notify_urgent,
            "deadlines": profile.notify_deadlines,
            "digest": profile.notify_digest,
            "attachments": profile.notify_attachments,
        },
    }


def coerce_bool(value):
    if isinstance(value, bool):
        return value
    if value is None:
        return None
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def build_notifications(user, profile):
    items = []

    gmail_connected = GmailCredential.objects.filter(user=user, refresh_token__isnull=False).exists()
    unread_count = EmailMessage.objects.filter(user=user, is_read=False).count()
    urgent_count = EmailPrediction.objects.filter(user=user, urgency="High").count()
    pending_tasks = ExtractedTask.objects.filter(user=user, status="Pending")
    deadline_count = pending_tasks.exclude(deadline__isnull=True).exclude(deadline="").count()
    attachment_count = EmailMessage.objects.filter(user=user).filter(
        Q(labels__icontains="HAS_ATTACHMENT") | Q(snippet__icontains="attach")
    ).count()

    if not gmail_connected:
        items.append(
            {
                "id": "gmail-connect",
                "kind": "gmail",
                "title": "Reconnect Gmail",
                "body": "MailMind needs an active Gmail connection to keep inbox updates flowing.",
                "level": "warning",
                "action_label": "Connect Gmail",
                "action_to": "/connect-email",
            }
        )

    if profile.notify_urgent and urgent_count:
        items.append(
            {
                "id": "urgent-queue",
                "kind": "urgent",
                "title": "Urgent emails waiting",
                "body": f"{urgent_count} high-priority emails need attention in your inbox.",
                "level": "urgent",
                "action_label": "Open Priority Emails",
                "action_to": "/app/priority",
                "count": urgent_count,
            }
        )

    if unread_count:
        items.append(
            {
                "id": "unread-mail",
                "kind": "unread",
                "title": "Unread email count changed",
                "body": f"You currently have {unread_count} unread synced emails.",
                "level": "info",
                "action_label": "Open Unread",
                "action_to": "/app/inbox?mailbox=unread",
                "count": unread_count,
            }
        )

    if profile.notify_deadlines and deadline_count:
        items.append(
            {
                "id": "task-deadlines",
                "kind": "tasks",
                "title": "Tasks with deadline cues",
                "body": f"{deadline_count} extracted tasks include deadline information.",
                "level": "warning",
                "action_label": "Open Tasks",
                "action_to": "/app/tasks",
                "count": deadline_count,
            }
        )

    if profile.notify_attachments and attachment_count:
        items.append(
            {
                "id": "attachments",
                "kind": "attachments",
                "title": "Attachments available",
                "body": f"{attachment_count} synced emails include attachments ready to review.",
                "level": "info",
                "action_label": "Open Attachments",
                "action_to": "/app/attachments",
                "count": attachment_count,
            }
        )

    if profile.notify_digest and (urgent_count or pending_tasks.count() or unread_count):
        items.append(
            {
                "id": "digest",
                "kind": "digest",
                "title": "Inbox summary ready",
                "body": f"{urgent_count} urgent, {pending_tasks.count()} pending tasks, and {unread_count} unread emails are in your workspace.",
                "level": "success",
                "action_label": "Open Dashboard",
                "action_to": "/app/dashboard",
            }
        )

    return items


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        return Response(
            {"message": "User registered successfully", "user_id": user.id},
            status=status.HTTP_201_CREATED,
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def me(request):
    user = request.user
    profile = get_profile(user)

    if request.method == "GET":
        return Response(serialize_profile(request, user, profile))

    data = request.data
    errors = {}

    username = data.get("username")
    email = data.get("email")
    job_title = data.get("job_title")

    if username and username != user.username and User.objects.filter(username=username).exclude(pk=user.pk).exists():
        errors["username"] = ["Username already exists."]
    if email and email != user.email and User.objects.filter(email=email).exclude(pk=user.pk).exists():
        errors["email"] = ["Email already exists."]

    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)

    if username is not None:
        user.username = username.strip()
    if email is not None:
        user.email = email.strip()
    user.save(update_fields=["username", "email"])

    if job_title is not None:
        profile.job_title = str(job_title).strip()

    notification_payload = data.get("notification_preferences") or {}
    for source_key, target_attr in {
        "urgent": "notify_urgent",
        "deadlines": "notify_deadlines",
        "digest": "notify_digest",
        "attachments": "notify_attachments",
    }.items():
        raw_value = None
        if isinstance(notification_payload, dict) and source_key in notification_payload:
            raw_value = notification_payload.get(source_key)
        elif source_key in data:
            raw_value = data.get(source_key)

        value = coerce_bool(raw_value)
        if value is not None:
            setattr(profile, target_attr, value)

    if coerce_bool(data.get("remove_photo")) and profile.profile_photo:
        profile.profile_photo.delete(save=False)
        profile.profile_photo = None

    uploaded_photo = request.FILES.get("profile_photo")
    if uploaded_photo:
        if profile.profile_photo:
            profile.profile_photo.delete(save=False)
        profile.profile_photo = uploaded_photo

    profile.save()
    return Response(serialize_profile(request, user, profile))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    current_password = str(request.data.get("current_password") or "").strip()
    new_password = str(request.data.get("new_password") or "").strip()

    errors = {}
    if not current_password:
        errors["current_password"] = ["Enter your current password."]
    if not new_password:
        errors["new_password"] = ["Enter a new password."]

    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    if not user.check_password(current_password):
        return Response({"current_password": ["Your current password is incorrect."]}, status=status.HTTP_400_BAD_REQUEST)

    if current_password == new_password:
        return Response({"new_password": ["Choose a new password that is different from the current one."]}, status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_password(new_password, user=user)
    except Exception as exc:
        messages = getattr(exc, "messages", None) or ["Use a stronger password."]
        return Response({"new_password": messages}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.save(update_fields=["password"])
    return Response({"message": "Password updated successfully."})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def delete_account(request):
    confirmation = str(request.data.get("confirmation") or "").strip()
    current_password = str(request.data.get("current_password") or "").strip()

    if confirmation != "DELETE":
        return Response(
            {"confirmation": ['Type "DELETE" to confirm account deletion.']},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not current_password:
        return Response({"current_password": ["Enter your password to confirm deletion."]}, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    if not user.check_password(current_password):
        return Response({"current_password": ["Your password is incorrect."]}, status=status.HTTP_400_BAD_REQUEST)

    user.delete()
    return Response({"message": "Your MailMind account has been deleted."})


@api_view(["POST"])
@permission_classes([AllowAny])
def forgot_password(request):
    email = str(request.data.get("email") or "").strip().lower()
    if not email:
        return Response({"email": ["Enter your email address."]}, status=status.HTTP_400_BAD_REQUEST)

    # Always return the same message to prevent email enumeration
    generic_response = Response({"message": "If that email is registered, a recovery link has been sent."})

    try:
        user = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        return generic_response

    token = default_token_generator.make_token(user)
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    reset_url = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"

    send_mail(
        subject="Reset your MailMind password",
        message=(
            f"Hi {user.username},\n\n"
            f"Someone requested a password reset for your MailMind account.\n\n"
            f"Click the link below to set a new password:\n\n"
            f"{reset_url}\n\n"
            f"This link expires in 24 hours. If you did not request this, you can safely ignore this email.\n\n"
            f"— The MailMind team"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )

    return generic_response


@api_view(["POST"])
@permission_classes([AllowAny])
def reset_password(request):
    uid = str(request.data.get("uid") or "").strip()
    token = str(request.data.get("token") or "").strip()
    new_password = str(request.data.get("new_password") or "").strip()

    if not uid or not token:
        return Response({"token": ["This reset link is invalid or has expired."]}, status=status.HTTP_400_BAD_REQUEST)
    if not new_password:
        return Response({"new_password": ["Enter a new password."]}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user_pk = urlsafe_base64_decode(uid).decode()
        user = User.objects.get(pk=user_pk)
    except Exception:
        return Response({"token": ["This reset link is invalid or has expired."]}, status=status.HTTP_400_BAD_REQUEST)

    if not default_token_generator.check_token(user, token):
        return Response({"token": ["This reset link is invalid or has expired."]}, status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_password(new_password, user=user)
    except Exception as exc:
        messages = getattr(exc, "messages", None) or ["Use a stronger password."]
        return Response({"new_password": messages}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.save(update_fields=["password"])
    return Response({"message": "Your password has been reset. You can now sign in."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def notifications(request):
    profile = get_profile(request.user)
    items = build_notifications(request.user, profile)
    return Response(
        {
            "count": len(items),
            "items": items,
            "profile": serialize_profile(request, request.user, profile),
        }
    )
