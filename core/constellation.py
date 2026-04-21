import httpx

from core import lexicon
from core.models import BacklinkRef, BacklinksResponse
from core.shared import SERVICES

BASE_URL = SERVICES["constellation"]


async def get_backlinks(
    client: httpx.AsyncClient,
    subject: str,
    source: str,
    limit: int = 50,
    cursor: str | None = None,
) -> BacklinksResponse:
    """Query Constellation for records that link to a subject."""
    params: dict[str, str | int] = {
        "subject": subject,
        "source": source,
        "limit": limit,
    }
    if cursor is not None:
        params["cursor"] = cursor
    resp = await client.get(
        f"{BASE_URL}/blue.microcosm.links.getBacklinks",
        params=params,
    )
    resp.raise_for_status()
    data = resp.json()
    return BacklinksResponse(
        total=data["total"],
        records=[
            BacklinkRef(
                did=entry["did"], collection=entry["collection"], rkey=entry["rkey"]
            )
            for entry in data["records"]
        ],
        cursor=data.get("cursor"),
    )


async def get_board_activity(
    client: httpx.AsyncClient,
    board_uri: str,
    limit: int = 100,
    cursor: str | None = None,
) -> BacklinksResponse:
    """Get all posts (threads and replies) for a board, newest first."""
    return await get_backlinks(
        client,
        subject=board_uri,
        source=f"{lexicon.POST}:scope",
        limit=limit,
        cursor=cursor,
    )


async def get_root_posts(
    client: httpx.AsyncClient,
    scope_uri: str,
    limit: int = 50,
    cursor: str | None = None,
) -> BacklinksResponse:
    """Get root posts (threads or news) pointing at a scope (board or site)."""
    return await get_backlinks(
        client,
        subject=scope_uri,
        source=f"{lexicon.POST}:scope",
        limit=limit,
        cursor=cursor,
    )


async def get_replies(
    client: httpx.AsyncClient,
    root_uri: str,
    limit: int = 50,
    cursor: str | None = None,
) -> BacklinksResponse:
    """Get replies pointing at a root post."""
    return await get_backlinks(
        client,
        subject=root_uri,
        source=f"{lexicon.POST}:root",
        limit=limit,
        cursor=cursor,
    )
