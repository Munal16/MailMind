import os
from django.utils import timezone
from django.core import signing
from django.shortcuts import redirect

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from google_auth_oauthlib.flow import Flow

from .models import GmailCredential

GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
]


def _get_flow(state=None):
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
        scopes=GMAIL_SCOPES,
        state=state,
        redirect_uri=os.getenv("GOOGLE_REDIRECT_URI"),
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def gmail_auth_url(request):
    state = signing.dumps({"user_id": request.user.id})
    flow = _get_flow(state=state)

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
        user_id = data["user_id"]
    except signing.BadSignature:
        return Response({"error": "Invalid state"}, status=400)

    flow = _get_flow(state=state)
    flow.fetch_token(code=code)
    creds = flow.credentials

    obj, _ = GmailCredential.objects.get_or_create(user_id=user_id)
    obj.access_token = creds.token
    obj.refresh_token = creds.refresh_token or obj.refresh_token
    obj.token_uri = creds.token_uri
    obj.client_id = creds.client_id
    obj.client_secret = creds.client_secret
    obj.scopes = ",".join(creds.scopes or [])
    obj.expiry = creds.expiry if creds.expiry else timezone.now()
    obj.save()

    frontend = os.getenv("FRONTEND_URL", "http://localhost:5173")
    return redirect(f"{frontend}/gmail-connected")