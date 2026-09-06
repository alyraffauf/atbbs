import mimetypes
from pathlib import Path

import piexif

from core.auth.session import OAuthSession
from core.pds import upload_blob


def strip_image_metadata(data: bytes, mime_type: str) -> bytes:
    """Remove EXIF metadata from JPEG images to protect user privacy."""
    if mime_type not in ("image/jpeg", "image/jpg"):
        return data
    try:
        return piexif.remove(data)
    except Exception:
        return data


async def upload_file(screen, file_path: str, session: OAuthSession) -> list[dict] | None:
    """Upload a file and return attachments list, or None on error."""
    path = Path(file_path).expanduser().resolve()
    if not path.exists():
        screen.notify(f"File not found: {path}", severity="error")
        return None
    if not path.is_file():
        screen.notify(f"Not a file: {path}", severity="error")
        return None

    file_bytes = path.read_bytes()
    mime_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    cleaned_bytes = strip_image_metadata(file_bytes, mime_type)

    async def session_updater(owned_session, **changes):
        if "dpop_pds_nonce" in changes:
            screen.app.session_store.update_pds_nonce(
                owned_session, changes["dpop_pds_nonce"]
            )

    try:
        blob_ref = await upload_blob(
            screen.app.http_client,
            session,
            cleaned_bytes,
            mime_type,
            session_updater=session_updater,
        )
        return [{"file": blob_ref, "name": path.name}]
    except Exception as error:
        screen.notify(f"Failed to upload file: {error}", severity="error")
        return None
