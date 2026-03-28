from datetime import timezone as dt_timezone

from google.auth.exceptions import RefreshError, TransportError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from django.utils import timezone

from .models import GmailCredential


class GmailAuthError(Exception):
    pass


def _normalized_expiry(value):
    if not value:
        return None
    if timezone.is_naive(value):
        return timezone.make_aware(value, dt_timezone.utc)
    return value


def get_gmail_service(user):
    cred = GmailCredential.objects.filter(user=user).first()
    if not cred or not cred.refresh_token:
        raise GmailAuthError("Gmail is not connected. Please connect Gmail first.")

    creds = Credentials(
        token=cred.access_token,
        refresh_token=cred.refresh_token,
        token_uri=cred.token_uri,
        client_id=cred.client_id,
        client_secret=cred.client_secret,
        scopes=(cred.scopes.split(",") if cred.scopes else None),
    )

    try:
        if creds.refresh_token:
            creds.refresh(Request())
            cred.access_token = creds.token
            cred.refresh_token = creds.refresh_token or cred.refresh_token
            cred.expiry = _normalized_expiry(creds.expiry)
            if creds.scopes:
                cred.scopes = ",".join(creds.scopes)
            cred.save()
        elif not creds.valid:
            raise GmailAuthError("Gmail authorization expired. Please reconnect Gmail.")
    except RefreshError as exc:
        cred.access_token = None
        cred.refresh_token = None
        cred.expiry = None
        cred.save(update_fields=["access_token", "refresh_token", "expiry", "updated_at"])
        raise GmailAuthError("Your Gmail authorization expired or was revoked. Please reconnect Gmail.") from exc
    except TransportError as exc:
        raise GmailAuthError("MailMind could not reach Gmail right now. Check your internet connection and try again.") from exc

    return build("gmail", "v1", credentials=creds)
