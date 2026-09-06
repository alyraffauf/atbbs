import asyncio

import httpx
import pytest

from core.auth.oauth import (
    is_safe_url,
    is_valid_authserver_meta,
    public_https_request,
    resolve_public_https_url,
)
from tui.local_server import start_callback_listener


@pytest.fixture
def anyio_backend():
    return "asyncio"


def test_oauth_urls_reject_private_destinations():
    for url in (
        "http://example.com",
        "https://localhost",
        "https://127.0.0.1",
        "https://10.0.0.1",
    ):
        assert not is_safe_url(url)


def test_auth_metadata_validation_returns_false_instead_of_asserting():
    assert not is_valid_authserver_meta({}, "https://auth.example")


@pytest.mark.anyio
async def test_oauth_resolution_rejects_any_private_dns_answer(monkeypatch):
    async def getaddrinfo(*args, **kwargs):
        return [
            (2, 1, 6, "", ("8.8.8.8", 443)),
            (2, 1, 6, "", ("127.0.0.1", 443)),
        ]

    loop = asyncio.get_running_loop()
    monkeypatch.setattr(loop, "getaddrinfo", getaddrinfo)
    with pytest.raises(ValueError, match="non-global"):
        await resolve_public_https_url("https://auth.example")


@pytest.mark.anyio
async def test_oauth_request_pins_address_and_preserves_tls_name(monkeypatch):
    async def resolve(url):
        return "auth.example", "8.8.8.8"

    seen = {}

    def respond(request: httpx.Request):
        seen["request"] = request
        return httpx.Response(200, request=request)

    monkeypatch.setattr("core.auth.oauth.resolve_public_https_url", resolve)
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        await public_https_request(client, "GET", "https://auth.example/token")

    request = seen["request"]
    assert request.url.host == "8.8.8.8"
    assert request.headers["host"] == "auth.example"
    assert request.extensions["sni_hostname"] == "auth.example"


@pytest.mark.anyio
async def test_callback_listener_ignores_wrong_state():
    listener = await start_callback_listener("expected", port=0)
    async with httpx.AsyncClient() as client:
        invalid = await client.get(
            f"http://127.0.0.1:{listener.port}/oauth/callback",
            params={"state": "wrong", "code": "bad"},
        )
        assert invalid.status_code == 400
        assert not listener.event.is_set()
        valid = await client.get(
            f"http://127.0.0.1:{listener.port}/oauth/callback",
            params={"state": "expected", "code": "good"},
        )
        assert valid.status_code == 200
    assert (await listener.wait())["code"] == "good"
