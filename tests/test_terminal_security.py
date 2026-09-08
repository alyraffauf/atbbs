import subprocess

import httpx
import pytest

from tui.util import (
    MAX_ATTACHMENT_DOWNLOAD_BYTES,
    AttachmentTooLargeError,
    download_blob,
    open_external_url,
)
from tui.widgets.post import AttachmentLink


@pytest.fixture
def anyio_backend():
    return "asyncio"


def test_focused_attachment_link_can_start_download(monkeypatch):
    downloads = []
    monkeypatch.setattr(
        AttachmentLink,
        "_save",
        lambda self: downloads.append(self._filename),
    )

    attachment = AttachmentLink("file", "https://pds.example/blob", "file.txt")
    ordinary_link = AttachmentLink("site", "https://example.com")

    assert attachment.save_attachment()
    assert not ordinary_link.save_attachment()
    assert downloads == ["file.txt"]


def test_linux_external_url_opener_discards_desktop_output(monkeypatch):
    launched = {}

    def popen(command, **options):
        launched["command"] = command
        launched["options"] = options

    monkeypatch.setattr("tui.util.sys.platform", "linux")
    monkeypatch.setattr("tui.util.subprocess.Popen", popen)

    assert open_external_url("https://example.com")
    assert launched["command"] == ["xdg-open", "https://example.com"]
    assert launched["options"] == {
        "stdin": subprocess.DEVNULL,
        "stdout": subprocess.DEVNULL,
        "stderr": subprocess.DEVNULL,
        "start_new_session": True,
    }


@pytest.mark.anyio
async def test_download_blob_sanitizes_and_limits_name(tmp_path):
    transport = httpx.MockTransport(
        lambda request: httpx.Response(200, content=b"payload", request=request)
    )
    async with httpx.AsyncClient(transport=transport) as client:
        saved = await download_blob(
            client, "https://blob.example/file", "../../escape.txt", tmp_path
        )

    assert saved == tmp_path / "escape.txt"
    assert saved.read_bytes() == b"payload"


@pytest.mark.anyio
async def test_download_blob_rejects_oversized_content_length(tmp_path):
    oversized_bytes = MAX_ATTACHMENT_DOWNLOAD_BYTES + 1
    transport = httpx.MockTransport(
        lambda request: httpx.Response(
            200,
            headers={"content-length": str(oversized_bytes)},
            content=b"x",
            request=request,
        )
    )
    async with httpx.AsyncClient(transport=transport) as client:
        with pytest.raises(AttachmentTooLargeError, match="100 MiB"):
            await download_blob(client, "https://blob.example/file", "x", tmp_path)
    assert list(tmp_path.iterdir()) == []
