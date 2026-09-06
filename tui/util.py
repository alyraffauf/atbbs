"""TUI utilities."""

import logging
import os
import subprocess
import sys
import tempfile
import webbrowser
from pathlib import Path

import httpx
from platformdirs import user_downloads_dir

from core.auth.session import OAuthSession, SessionStore
from core.models import AuthError, BBS
from core.pds import create_ban_record, create_hidden_record
from core.resolver import invalidate_bbs_cache

logger = logging.getLogger(__name__)

MAX_ATTACHMENT_DOWNLOAD_BYTES = 100 * 1024 * 1024


class AttachmentTooLargeError(ValueError):
    def __init__(self, size_bytes: int, max_bytes: int) -> None:
        self.size_bytes = size_bytes
        self.max_bytes = max_bytes
        super().__init__(
            f"Attachment is {size_bytes / 1024 / 1024:.1f} MiB; "
            f"the download limit is {max_bytes / 1024 / 1024:.0f} MiB."
        )


def open_external_url(url: str) -> bool:
    if not sys.platform.startswith("linux"):
        return webbrowser.open(url)

    try:
        subprocess.Popen(
            ["xdg-open", url],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
    except OSError:
        return False
    return True


def unique_path(path: Path) -> Path:
    """Return path, or path with a `_N` suffix if it already exists."""
    if not path.exists():
        return path
    stem, suffix = path.stem, path.suffix
    counter = 1
    while True:
        candidate = path.parent / f"{stem}_{counter}{suffix}"
        if not candidate.exists():
            return candidate
        counter += 1


async def download_blob(
    client: httpx.AsyncClient,
    url: str,
    filename: str,
    downloads_dir: Path | None = None,
    max_bytes: int = MAX_ATTACHMENT_DOWNLOAD_BYTES,
) -> Path:
    """Stream a size-limited blob to a contained, atomically named file."""
    downloads = (downloads_dir or Path(user_downloads_dir())).resolve()
    downloads.mkdir(parents=True, exist_ok=True)
    safe_name = Path(filename.replace("\\", "/")).name
    if safe_name in ("", ".", ".."):
        safe_name = "file"
    path = unique_path(downloads / safe_name)
    if not path.resolve(strict=False).is_relative_to(downloads):
        raise ValueError("Attachment path escapes the downloads directory")

    descriptor, temporary_name = tempfile.mkstemp(prefix=".atbbs-", dir=downloads)
    temporary_path = Path(temporary_name)
    total = 0
    try:
        with os.fdopen(descriptor, "wb") as output:
            async with client.stream("GET", url) as response:
                response.raise_for_status()
                content_length = response.headers.get("content-length")
                if content_length and int(content_length) > max_bytes:
                    raise AttachmentTooLargeError(int(content_length), max_bytes)
                async for chunk in response.aiter_bytes():
                    total += len(chunk)
                    if total > max_bytes:
                        raise AttachmentTooLargeError(total, max_bytes)
                    output.write(chunk)
                output.flush()
                os.fsync(output.fileno())
        os.replace(temporary_path, path)
        return path
    finally:
        temporary_path.unlink(missing_ok=True)


def require_session(screen) -> OAuthSession | None:
    """Return the user session if logged in, else notify and return None."""
    session = screen.app.user_session
    if not session:
        screen.notify("You must be logged in to do that.", severity="error")
        return None
    return session


def require_sysop(screen, bbs: BBS) -> OAuthSession | None:
    """Return the user session if logged in AND is the BBS sysop.

    Shows an error notification and returns None otherwise.
    """
    session = screen.app.user_session
    if not session:
        screen.notify("You must be logged in to do that.", severity="error")
        return None
    if session["did"] != bbs.identity.did:
        screen.notify("Only the sysop can do that.", severity="error")
        return None
    return session


def make_session_updater(store: SessionStore):
    """Create a session_updater callback for PDS write operations."""

    async def updater(session, **changes):
        if "dpop_pds_nonce" in changes:
            store.update_pds_nonce(session, changes["dpop_pds_nonce"])
        if "access_token" in changes:
            store.update_tokens(
                session,
                changes["access_token"],
                changes["refresh_token"],
                changes["dpop_authserver_nonce"],
            )

    return updater


async def ban_user(screen, did: str) -> bool:
    """Ban a user by DID. Returns True on success, False on failure.

    Handles the full workflow: create ban record, invalidate cache,
    and show a success or error notification.
    """
    session = screen.app.user_session
    updater = make_session_updater(screen.app.session_store)
    try:
        await create_ban_record(screen.app.http_client, session, did, updater)
        invalidate_bbs_cache()
        screen.notify(f"Banned {did}.")
        return True
    except AuthError:
        screen.notify("Session expired. Please log in again.", severity="error")
        return False
    except Exception as error:
        logger.exception(
            "Ban creation failed",
            extra={
                "operation": "create_ban",
                "route": did,
                "exception_type": type(error).__name__,
            },
        )
        screen.notify("Could not ban user.", severity="error")
        return False


async def hide_post(screen, uri: str) -> bool:
    """Hide a post by AT-URI. Returns True on success, False on failure.

    Handles the full workflow: create hidden record, invalidate cache,
    and show a success or error notification.
    """
    session = screen.app.user_session
    updater = make_session_updater(screen.app.session_store)
    try:
        await create_hidden_record(screen.app.http_client, session, uri, updater)
        invalidate_bbs_cache()
        screen.notify("Post hidden.")
        return True
    except AuthError:
        screen.notify("Session expired. Please log in again.", severity="error")
        return False
    except Exception as error:
        logger.exception(
            "Hide creation failed",
            extra={
                "operation": "create_hide",
                "route": uri,
                "exception_type": type(error).__name__,
            },
        )
        screen.notify("Could not hide post.", severity="error")
        return False
