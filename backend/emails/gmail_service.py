from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

from .models import GmailCredential


def get_gmail_service(user):
    cred = GmailCredential.objects.filter(user=user).first()
    if not cred or not cred.refresh_token:
        raise ValueError("Gmail not connected or refresh_token missing.")

    creds = Credentials(
        token=cred.access_token,
        refresh_token=cred.refresh_token,
        token_uri=cred.token_uri,
        client_id=cred.client_id,
        client_secret=cred.client_secret,
        scopes=(cred.scopes.split(",") if cred.scopes else None),
    )

    # Refresh if needed
    if not creds.valid:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            # Save updated access token back to DB
            cred.access_token = creds.token
            cred.expiry = creds.expiry
            cred.save()

    return build("gmail", "v1", credentials=creds)
