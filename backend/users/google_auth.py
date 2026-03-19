from django.core import signing

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from emails.gmail_oauth import LOGIN_SCOPES, _get_flow


@api_view(["GET"])
@permission_classes([AllowAny])
def google_login_url(request):
    state = signing.dumps({"type": "google_login"})
    flow = _get_flow(scopes=LOGIN_SCOPES, state=state)

    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="select_account",
    )
    return Response({"authorization_url": auth_url})
