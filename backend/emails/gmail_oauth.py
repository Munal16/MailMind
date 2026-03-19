import os
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
from rest_framework_simplejwt.tokens import RefreshToken

from .models import GmailCredential

GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
]

LOGIN_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]


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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def gmail_auth_url(request):
    state = signing.dumps({"type": "gmail_connect", "user_id": request.user.id})
    flow = _get_flow(scopes=GMAIL_SCOPES, state=state)

    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return Response({"authorization_url": auth_url})


@api_view(["GET"])
@permission_classes([AllowAny])
def gmail_callback(request):
    code = request.GET.get("code")
    state = request.GET.get("state")

    if not code or not state:
        return Response({"error": "Missing code/state"}, status=400)

    try:
        data = signing.loads(state, max_age=600)
        state_type = data.get("type", "gmail_connect")
    except signing.BadSignature:
        return Response({"error": "Invalid state"}, status=400)

    if state_type == "google_login":
        flow = _get_flow(scopes=LOGIN_SCOPES, state=state)
        flow.fetch_token(code=code)
        creds = flow.credentials

        if not creds.id_token:
            return Response({"error": "Google login did not return an ID token."}, status=400)

        token_info = id_token.verify_oauth2_token(
            creds.id_token,
            Request(),
            os.getenv("GOOGLE_CLIENT_ID"),
        )

        email = token_info.get("email")
        name = token_info.get("name") or token_info.get("given_name")
        sub = token_info.get("sub")

        if not email:
            return Response({"error": "Google account email not available."}, status=400)

        from django.contrib.auth.models import User

        user = User.objects.filter(email=email).first()
        if not user:
            user = User.objects.create_user(
                username=_unique_username(email=email, name=name, sub=sub),
                email=email,
                password=User.objects.make_random_password(),
                first_name=name or "",
            )

        refresh = RefreshToken.for_user(user)
        return redirect(
            _build_frontend_redirect(
                "/auth/google/callback",
                access=str(refresh.access_token),
                refresh=str(refresh),
            )
        )

    user_id = data["user_id"]
    flow = _get_flow(scopes=GMAIL_SCOPES, state=state)
    flow.fetch_token(code=code)
    creds = flow.credentials

    if not creds.refresh_token:
        return redirect(
            _build_frontend_redirect(
                "/connect-email",
                gmail="error",
                message="Google did not return a refresh token. Remove MailMind from Google account permissions and connect Gmail again.",
            )
        )

    obj, _ = GmailCredential.objects.get_or_create(user_id=user_id)
    obj.access_token = creds.token
    obj.refresh_token = creds.refresh_token
    obj.token_uri = creds.token_uri
    obj.client_id = creds.client_id
    obj.client_secret = creds.client_secret
    obj.scopes = ",".join(creds.scopes or [])
    obj.expiry = creds.expiry if creds.expiry else timezone.now()
    obj.save()

    return redirect(_build_frontend_redirect("/connect-email", gmail="connected"))
