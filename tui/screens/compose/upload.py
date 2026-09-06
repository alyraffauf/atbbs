import mimetypes
import asyncio
import logging
import struct
from pathlib import Path

import piexif

from core.auth.session import OAuthSession
from core.pds import upload_blob
from core.limits import MAX_ATTACHMENT_BYTES, MAX_IMAGE_PIXELS

logger = logging.getLogger(__name__)


def strip_image_metadata(data: bytes, mime_type: str) -> bytes:
    """Remove EXIF metadata from JPEG images to protect user privacy."""
    if mime_type not in ("image/jpeg", "image/jpg"):
        return data
    try:
        return piexif.remove(data)
    except Exception:
        return data


def image_dimensions(data: bytes) -> tuple[int, int] | None:
    """Read PNG, GIF, or JPEG dimensions without decoding pixel data."""
    if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24:
        return struct.unpack(">II", data[16:24])
    if data[:6] in (b"GIF87a", b"GIF89a") and len(data) >= 10:
        return struct.unpack("<HH", data[6:10])
    if data.startswith(b"\xff\xd8"):
        offset = 2
        while offset + 9 <= len(data):
            if data[offset] != 0xFF:
                offset += 1
                continue
            marker = data[offset + 1]
            if marker in range(0xC0, 0xC4):
                height, width = struct.unpack(">HH", data[offset + 5 : offset + 9])
                return width, height
            if offset + 4 > len(data):
                break
            length = struct.unpack(">H", data[offset + 2 : offset + 4])[0]
            offset += 2 + length
    return None


async def upload_file(screen, file_path: str, session: OAuthSession) -> list[dict] | None:
    """Upload a file and return attachments list, or None on error."""
    path = Path(file_path).expanduser().resolve()
    if not path.exists():
        screen.notify(f"File not found: {path}", severity="error")
        return None
    if not path.is_file():
        screen.notify(f"Not a file: {path}", severity="error")
        return None

    if path.stat().st_size > MAX_ATTACHMENT_BYTES:
        screen.notify("File is larger than 1,000,000 bytes.", severity="error")
        return None
    file_bytes = await asyncio.to_thread(path.read_bytes)
    mime_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    dimensions = image_dimensions(file_bytes)
    if dimensions and dimensions[0] * dimensions[1] > MAX_IMAGE_PIXELS:
        screen.notify("Image is larger than 40 million pixels.", severity="error")
        return None
    cleaned_bytes = await asyncio.to_thread(strip_image_metadata, file_bytes, mime_type)

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
        logger.exception(
            "Attachment upload failed",
            extra={
                "operation": "upload_attachment",
                "route": str(path),
                "exception_type": type(error).__name__,
            },
        )
        screen.notify("Failed to upload file.", severity="error")
        return None
