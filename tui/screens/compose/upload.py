import mimetypes
from pathlib import Path

from core.records import upload_blob


async def upload_file(screen, file_path: str, session: dict) -> list[dict] | None:
    """Upload a file and return attachments list, or None on error."""
    path = Path(file_path).expanduser().resolve()
    if not path.exists():
        screen.notify(f"File not found: {path}", severity="error")
        return None
    if not path.is_file():
        screen.notify(f"Not a file: {path}", severity="error")
        return None

    data = path.read_bytes()
    mime = mimetypes.guess_type(str(path))[0] or "application/octet-stream"

    async def nonce_updater(did, field, value):
        if hasattr(screen.app, "user_session") and screen.app.user_session:
            screen.app.user_session[field] = value

    try:
        blob_ref = await upload_blob(
            screen.app.http_client, session, data, mime, session_updater=nonce_updater
        )
        return [{"file": blob_ref, "name": path.name}]
    except Exception as error:
        screen.notify(f"Failed to upload file: {error}", severity="error")
        return None
