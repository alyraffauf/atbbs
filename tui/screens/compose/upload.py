import mimetypes
from pathlib import Path

import piexif

from core.records import upload_blob


def strip_image_metadata(data: bytes, mime_type: str) -> bytes:
    """Remove EXIF metadata from JPEG images to protect user privacy."""
    if mime_type not in ("image/jpeg", "image/jpg"):
        return data
    try:
        return piexif.remove(data)
    except Exception:
        return data


async def upload_file(screen, file_path: str, session: dict) -> list[dict] | None:
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

    async def nonce_updater(did, field, value):
        if hasattr(screen.app, "user_session") and screen.app.user_session:
            screen.app.user_session[field] = value

    try:
        blob_ref = await upload_blob(
            screen.app.http_client,
            session,
            cleaned_bytes,
            mime_type,
            session_updater=nonce_updater,
        )
        return [{"file": blob_ref, "name": path.name}]
    except Exception as error:
        screen.notify(f"Failed to upload file: {error}", severity="error")
        return None
