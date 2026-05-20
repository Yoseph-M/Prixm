"""
Firebase Authentication dependency for FastAPI.

SECURITY ARCHITECTURE
=====================
This module creates a single reusable dependency `get_current_user` that:
  1. Reads the Bearer token from the Authorization header.
  2. Verifies it against Firebase using `auth.verify_id_token()`.
  3. Returns the decoded token dict containing `uid`, `email`, `name`.

WHY EXTRACT user_id FROM THE VERIFIED TOKEN, NOT THE REQUEST BODY?
------------------------------------------------------------------
The Firebase ID token is cryptographically signed by Google. When we call
`verify_id_token()`, the Admin SDK checks the signature, expiry, audience,
and issuer. The `uid` inside the token is therefore trustworthy.

If we accepted `user_id` from the request body or query params, any client
could forge it — sending someone else's uid to read/modify their data.
By always extracting `uid` from the verified token, we guarantee that the
caller is who they claim to be.

WHY CATCH ExpiredIdTokenError SEPARATELY?
-----------------------------------------
A generic "invalid token" error might mean the token is malformed, revoked,
or for a different Firebase project. An expired token is a normal lifecycle
event — the frontend should silently refresh and retry. Separating the two
lets us return a clearer 401 message so the frontend can decide whether to
retry (expired) or force a re-login (invalid).
"""
from __future__ import annotations

import firebase_admin
from firebase_admin import auth, credentials
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .config import settings

# ── Firebase Admin SDK initialisation ──────────────────────────────────────
# The SDK reads the service account JSON from the path in the environment
# variable GOOGLE_APPLICATION_CREDENTIALS (set in .env / docker-compose).
# We initialise once at import time; subsequent calls are no-ops.
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate(settings.GOOGLE_APPLICATION_CREDENTIALS)
        firebase_admin.initialize_app(cred)
except Exception as e:
    # Allow app to start without Firebase in development
    print(f"Warning: Firebase init failed: {e}. Some endpoints may not work.")

# HTTPBearer extracts "Bearer <token>" from the Authorization header and
# returns an HTTPAuthorizationCredentials object with `.credentials`.
_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    token: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    """
    FastAPI dependency that verifies the Firebase ID token and returns
    the decoded token dict.  Use `Depends(get_current_user)` on any
    protected route.

    Returns dict with at least: uid, email, name (may be None).
    """
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token. Send a Firebase ID token as 'Authorization: Bearer <token>'.",
        )

    try:
        decoded = auth.verify_id_token(token.credentials)
    except auth.ExpiredIdTokenError:
        # Token structure is valid but it has expired.  The frontend
        # should call getIdToken(true) to force-refresh and retry.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please refresh your authentication token.",
        )
    except Exception:
        # Covers InvalidIdTokenError, RevokedIdTokenError, CertificateFetchError, etc.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token. Please sign in again.",
        )

    return decoded
