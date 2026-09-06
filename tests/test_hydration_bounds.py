import httpx
import pytest

from core.cache import TTLCache
from core.models import BBS, Board, BacklinkRef, BacklinksResponse, MiniDoc, Site
from core.records import hydrate_replies, hydrate_threads, list_pds_records


@pytest.fixture
def anyio_backend():
    return "asyncio"


def test_ttl_cache_has_a_hard_capacity():
    cache = TTLCache(60, max_entries=2)
    cache.set("a", 1)
    cache.set("b", 2)
    cache.set("c", 3)
    assert len(cache._entries) == 2


@pytest.mark.anyio
async def test_list_records_detects_repeated_cursor():
    def respond(request: httpx.Request):
        return httpx.Response(
            200,
            json={"records": [], "cursor": "same"},
            request=request,
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        result = await list_pds_records(
            client, "https://pds.example", "did:plc:test", "example.collection"
        )
    assert result.truncated
    assert result.next_cursor == "same"


@pytest.mark.anyio
async def test_reply_references_stop_at_two_thousand(monkeypatch):
    calls = 0

    async def replies(client, root_uri, limit=50, cursor=None):
        nonlocal calls
        calls += 1
        refs = [
            BacklinkRef("did:plc:a", "xyz.atbbs.post", f"r{calls}-{index}")
            for index in range(limit)
        ]
        return BacklinksResponse(2_001, refs, f"cursor-{calls}")

    async def no_records(client, refs):
        return []

    monkeypatch.setattr("core.records.get_replies", replies)
    monkeypatch.setattr("core.records.get_records_batch", no_records)
    bbs = BBS(MiniDoc("did:plc:bbs", "bbs.example"), Site("x", "", "", [], ""), [])
    page = await hydrate_replies(object(), bbs, "at://did:plc:a/xyz.atbbs.post/root")
    assert calls == 20
    assert page.total_replies == 2_000
    assert page.truncated


@pytest.mark.anyio
async def test_board_hydration_consumes_only_page_capacity(monkeypatch):
    refs = [BacklinkRef("did:plc:a", "xyz.atbbs.post", str(i)) for i in range(100)]

    async def activity(client, board_uri, limit=100, cursor=None):
        assert limit == 25
        return BacklinksResponse(100, refs)

    async def records(client, requested):
        assert len(requested) == 25
        return []

    monkeypatch.setattr("core.records.get_board_activity", activity)
    monkeypatch.setattr("core.records.get_records_batch", records)
    bbs = BBS(MiniDoc("did:plc:bbs", "bbs.example"), Site("x", "", "", [], ""), [])
    board = Board("general", "General", "", "")
    threads, cursor = await hydrate_threads(object(), bbs, board)
    assert threads == []
    assert cursor is None
