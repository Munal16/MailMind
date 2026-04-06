from datetime import timezone as dt_timezone

from django.db import transaction
from django.utils import timezone
from google.auth.exceptions import RefreshError, TransportError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from .models import GmailCredential


class GmailAuthError(Exception):
    pass


def _normalized_expiry(value):
    if not value:
        return None
    if timezone.is_naive(value):
        return timezone.make_aware(value, dt_timezone.utc)
    return value


def list_gmail_credentials(user):
    return GmailCredential.objects.filter(user=user).order_by("-is_active", "-updated_at", "-id")


def resolve_gmail_credential(user, credential=None, credential_id=None, email_address=None):
    if credential is not None:
        return credential

    queryset = list_gmail_credentials(user)

    if credential_id is not None:
        return queryset.filter(id=credential_id).first()

    if email_address:
        return queryset.filter(email_address__iexact=email_address).first()

    active = queryset.filter(is_active=True).first()
    if active:
        return active
    return queryset.first()


@transaction.atomic
def set_active_gmail_credential(user, credential):
    if not credential or credential.user_id != user.id:
        raise GmailAuthError("MailMind could not switch to that Gmail account.")

    GmailCredential.objects.filter(user=user, is_active=True).exclude(pk=credential.pk).update(is_active=False)
    if not credential.is_active:
        credential.is_active = True
        credential.save(update_fields=["is_active", "updated_at"])
    return credential


def get_active_gmail_credential(user):
    credential = resolve_gmail_credential(user)
    if credential and not credential.is_active:
        set_active_gmail_credential(user, credential)
    return credential


def serialize_gmail_credential(credential):
    return {
        "id": credential.id,
        "email_address": credential.email_address,
        "display_name": credential.display_name,
        "is_active": credential.is_active,
        "connected": bool(
            credential.refresh_token
            and credential.client_id
            and credential.client_secret
            and credential.token_uri
        ),
        "updated_at": credential.updated_at.isoformat() if credential.updated_at else None,
        "created_at": credential.created_at.isoformat() if credential.created_at else None,
    }


def get_gmail_service(user, credential=None, credential_id=None, email_address=None):
    cred = resolve_gmail_credential(
        user,
        credential=credential,
        credential_id=credential_id,
        email_address=email_address,
    )
    if not cred:
        raise GmailAuthError("Gmail is not connected. Please connect Gmail first.")

    if not cred.refresh_token:
        raise GmailAuthError("This Gmail account is no longer connected. Please reconnect it.")

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
            if not cred.is_active:
                set_active_gmail_credential(user, cred)
            cred.save()
        elif not creds.valid:
            raise GmailAuthError("Gmail authorization expired. Please reconnect Gmail.")
    except RefreshError as exc:
        cred.access_token = None
        cred.refresh_token = None
        cred.expiry = None
        cred.is_active = False
        cred.save(update_fields=["access_token", "refresh_token", "expiry", "is_active", "updated_at"])
        raise GmailAuthError("Your Gmail authorization expired or was revoked. Please reconnect Gmail.") from exc
    except TransportError as exc:
        raise GmailAuthError("MailMind could not reach Gmail right now. Check your internet connection and try again.") from exc

    return build("gmail", "v1", credentials=creds)
