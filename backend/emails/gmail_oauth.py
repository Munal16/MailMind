import os
import secrets
from datetime import timezone as dt_timezone
from urllib.parse import urlencode
from django.utils import timezone
from django.core import signing
from django.shortcuts import redirect

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from google_auth_oauthlib.flow import Flow
from google.oauth2 import id_token
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from rest_framework_simplejwt.tokens import RefreshToken

from .models import GmailCredential
from .gmail_service import set_active_gmail_credential
from users.models import UserProfile

os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")

GMAIL_SCOPES = [
    "https://mail.google.com/",
]

LOGIN_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]

CONNECT_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://mail.google.com/",
]


def _friendly_google_error(exc, default_message):
    message = str(exc or "").strip()
    lowered = message.lower()

    if "token used too early" in lowered or "check that your computer's clock is set correctly" in lowered:
        return "Google sign-in failed because your computer clock appears out of sync. Turn on automatic date and time, then try again."
    if "scope has changed from" in lowered:
        return "Google returned a mismatched permission set for this sign-in attempt. Please try again. If it keeps happening, remove MailMind from your Google connected apps and reconnect."
    if "invalid_grant" in lowered:
        return "Google sign-in expired before it completed. Please try again."
    if "missing code" in lowered or "missing state" in lowered:
        return "Google did not complete the authorization flow. Please try again."
    return message or default_message


def _normalized_expiry(value):
    if not value:
        return timezone.now()
    if timezone.is_naive(value):
        return timezone.make_aware(value, dt_timezone.utc)
    return value


def _get_flow(scopes=None, state=None):
    client_config = {
        "web": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }

    return Flow.from_client_config(
        client_config=client_config,
        scopes=scopes or GMAIL_SCOPES,
        state=state,
        redirect_uri=os.getenv("GOOGLE_REDIRECT_URI"),
    )


def _build_frontend_redirect(path, **params):
    frontend = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    query = urlencode({key: value for key, value in params.items() if value is not None})
    return f"{frontend}{path}" + (f"?{query}" if query else "")


def _unique_username(email=None, name=None, sub=None):
    from django.contrib.auth.models import User

    base = (name or (email.split("@")[0] if email else None) or sub or "google_user").strip()
    username = "".join(ch if ch.isalnum() or ch in {"_", "."} else "_" for ch in base).strip("._") or "google_user"
    candidate = username
    index = 1
    while User.objects.filter(username=candidate).exists():
        if email and User.objects.filter(username=candidate, email=email).exists():
            break
        candidate = f"{username}_{index}"
        index += 1
    return candidate


def _redirect_callback_error(state_type, message):
    if state_type == "google_login":
        return redirect(_build_frontend_redirect("/auth/google/callback", error=message))
    return redirect(_build_frontend_redirect("/connect-email", gmail="error", message=message))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def gmail_auth_url(request):
    state = signing.dumps({"type": "gmail_connect", "user_id": request.user.id})
    flow = _get_flow(scopes=CONNECT_SCOPES, state=state)

    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent select_account",
    )
    return Response({"authorization_url": auth_url})


@api_view(["GET"])
@permission_classes([AllowAny])
def gmail_callback(request):
    code = request.GET.get("code")
    state = request.GET.get("state")

    if not code or not state:
        return redirect(_build_frontend_redirect("/auth/google/callback", error="Google authorization did not return the required callback data."))

    try:
        data = signing.loads(state, max_age=600)
        state_type = data.get("type", "gmail_connect")
    except signing.BadSignature:
        return redirect(_build_frontend_redirect("/auth/google/callback", error="The Google sign-in session expired. Please try again."))

    if state_type == "google_login":
        try:
            flow = _get_flow(scopes=LOGIN_SCOPES, state=state)
            flow.fetch_token(code=code)
            creds = flow.credentials
        except Exception as exc:
            return _redirect_callback_error(
                state_type,
                _friendly_google_error(exc, "Google login could not be completed. Please try again."),
            )

        if not creds.id_token:
            return _redirect_callback_error(state_type, "Google login did not return an ID token.")

        try:
            token_info = id_token.verify_oauth2_token(
                creds.id_token,
                Request(),
                os.getenv("GOOGLE_CLIENT_ID"),
                clock_skew_in_seconds=60,
            )
        except Exception as exc:
            return _redirect_callback_error(
                state_type,
                _friendly_google_error(exc, "Google login token verification failed. Please try again."),
            )

        email = token_info.get("email")
        name = token_info.get("name") or token_info.get("given_name")
        sub = token_info.get("sub")

        if not email:
            return _redirect_callback_error(state_type, "Google account email was not available.")

        from django.contrib.auth.models import User

        user = User.objects.filter(email=email).first()
        if not user:
            user = User.objects.create_user(
                username=_unique_username(email=email, name=name, sub=sub),
                email=email,
                password=secrets.token_urlsafe(32),
                first_name=name or "",
            )
        elif name and not user.first_name:
            user.first_name = name
            user.save(update_fields=["first_name"])

        UserProfile.objects.get_or_create(user=user)

        refresh = RefreshToken.for_user(user)
        return redirect(
            _build_frontend_redirect(
                "/auth/google/callback",
                access=str(refresh.access_token),
                refresh=str(refresh),
            )
        )

    user_id = data["user_id"]
    try:
        flow = _get_flow(scopes=CONNECT_SCOPES, state=state)
        flow.fetch_token(code=code)
        creds = flow.credentials
    except Exception as exc:
        return _redirect_callback_error(
            state_type,
            _friendly_google_error(exc, "Gmail connection could not be completed. Please try again."),
        )

    if not creds.refresh_token:
        return _redirect_callback_error(
            state_type,
            "Google did not return a refresh token. Remove MailMind from Google account permissions and connect Gmail again.",
        )

    gmail_service = build("gmail", "v1", credentials=creds)
    profile = gmail_service.users().getProfile(userId="me").execute()
    email_address = (profile.get("emailAddress") or "").strip().lower()

    if not email_address:
        return _redirect_callback_error(
            state_type,
            "Google did not return the Gmail address for this connection. Please try again.",
        )

    obj, _ = GmailCredential.objects.update_or_create(
        user_id=user_id,
        email_address=email_address,
        defaults={
            "display_name": email_address.split("@", 1)[0],
        },
    )
    obj.access_token = creds.token
    obj.refresh_token = creds.refresh_token
    obj.token_uri = creds.token_uri
    obj.client_id = creds.client_id
    obj.client_secret = creds.client_secret
    obj.scopes = ",".join(creds.scopes or [])
    obj.expiry = _normalized_expiry(creds.expiry)
    obj.save()
    set_active_gmail_credential(obj.user, obj)

    return redirect(
        _build_frontend_redirect(
            "/connect-email",
            gmail="connected",
            account=email_address,
        )
    )
