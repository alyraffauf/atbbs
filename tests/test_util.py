import os
import time
from datetime import datetime

import pytest

from core.util import (
    attachment_cid,
    blob_url,
    format_datetime_local,
    format_datetime_utc,
    now_iso,
)


@pytest.fixture
def tz():
    """Set the process timezone for a test, then restore."""
    original = os.environ.get("TZ")

    def _set(name: str):
        os.environ["TZ"] = name
        time.tzset()

    yield _set
    if original is None:
        os.environ.pop("TZ", None)
    else:
        os.environ["TZ"] = original
    time.tzset()


def test_now_iso_is_parseable_utc():
    value = now_iso()
    dt = datetime.fromisoformat(value)
    assert dt.utcoffset().total_seconds() == 0


def test_now_iso_uses_z_suffix():
    value = now_iso()
    assert value.endswith("Z")
    assert "+00:00" not in value


def test_format_datetime_utc_passthrough():
    assert format_datetime_utc("2024-01-15T12:30:00+00:00") == "2024-01-15 12:30 UTC"


def test_format_datetime_utc_converts_offset_to_utc():
    # 17:30 +05:00 == 12:30 UTC
    assert format_datetime_utc("2024-01-15T17:30:00+05:00") == "2024-01-15 12:30 UTC"


def test_format_datetime_utc_converts_negative_offset():
    # 07:30 -05:00 == 12:30 UTC
    assert format_datetime_utc("2024-01-15T07:30:00-05:00") == "2024-01-15 12:30 UTC"


def test_format_datetime_local_converts_to_local(tz):
    tz("America/New_York")
    # 17:30 UTC in January = 12:30 EST (UTC-5)
    assert format_datetime_local("2024-01-15T17:30:00+00:00") == "2024-01-15 12:30"


def test_blob_url():
    url = blob_url("https://pds.example", "did:plc:abc", "bafy123")
    assert url == "https://pds.example/xrpc/com.atproto.sync.getBlob?did=did:plc:abc&cid=bafy123"


def test_blob_url_strips_trailing_slash():
    url = blob_url("https://pds.example/", "did:plc:abc", "bafy123")
    assert url == "https://pds.example/xrpc/com.atproto.sync.getBlob?did=did:plc:abc&cid=bafy123"


@pytest.mark.parametrize(
    "attachment,expected",
    [
        ({"file": {"ref": {"$link": "bafy123"}}}, "bafy123"),
        ({}, ""),
        ({"file": None}, ""),
        ({"file": {}}, ""),
        ({"file": {"ref": None}}, ""),
        ({"file": {"ref": {}}}, ""),
        ({"file": {"ref": {"$link": None}}}, ""),
    ],
    ids=["present", "missing_file", "null_file", "missing_ref", "null_ref", "missing_link", "null_link"],
)
def test_attachment_cid(attachment, expected):
    assert attachment_cid(attachment) == expected
