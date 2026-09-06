import os
import stat

import httpx
import pytest

from core.auth.session import OAuthSession, SessionStore
from core.records import pds_post


def make_session() -> OAuthSession:
    return OAuthSession(
        did="did:plc:test",
        handle="test.example",
        pds_url="https://pds.example",
        authserver_iss="https://auth.example",
        access_token="old-access",
        refresh_token="old-refresh",
        dpop_authserver_nonce="old-nonce",
        dpop_pds_nonce="",
        dpop_private_jwk="{}",
        client_id="http://localhost",
    )


def test_session_store_tightens_permissions_and_updates_tokens(tmp_path):
    os.chmod(tmp_path, 0o755)
    store = SessionStore(str(tmp_path / "atbbs.db"))
    session = store.save_session(make_session())

    assert stat.S_IMODE(tmp_path.stat().st_mode) == 0o700
    assert stat.S_IMODE((tmp_path / "atbbs.db").stat().st_mode) == 0o600

    store.update_tokens(session, "access", "refresh", "nonce")
    restored = store.get_session(session.did)
    assert restored is not None
    assert (restored.access_token, restored.refresh_token) == ("access", "refresh")
    assert restored.dpop_authserver_nonce == "nonce"


def test_session_store_does_not_chmod_working_directory(tmp_path, monkeypatch):
    os.chmod(tmp_path, 0o755)
    monkeypatch.chdir(tmp_path)
    SessionStore("atbbs.db")
    assert stat.S_IMODE(tmp_path.stat().st_mode) == 0o755


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_pds_post_raises_when_the_server_rejects_a_write():
    session = make_session()
    session.dpop_private_jwk = ""
    transport = httpx.MockTransport(
        lambda request: httpx.Response(400, text="rejected", request=request)
    )

    async with httpx.AsyncClient(transport=transport) as client:
        with pytest.raises(httpx.HTTPStatusError):
            await pds_post(client, session, "com.atproto.repo.createRecord", {})
