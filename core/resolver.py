import asyncio

import httpx

from core.models import (
    AtUri,
    BBS,
    Board,
    News,
    Site,
    BBSNotFoundError,
    NoBBSError,
    NetworkError,
)
from core import lexicon
from core.constellation import get_news
from core.records import list_pds_records
from core.slingshot import get_record, get_records_batch, resolve_identity


async def resolve_bbs(client: httpx.AsyncClient, handle: str) -> BBS:
    """Handle -> fully resolved BBS config."""
    try:
        identity = await resolve_identity(client, handle)
    except httpx.HTTPStatusError:
        raise BBSNotFoundError(f"Could not resolve handle: {handle}")
    except httpx.TransportError:
        raise NetworkError("Could not reach the network.")

    try:
        site_record = await get_record(client, identity.did, lexicon.SITE, "self")
    except httpx.HTTPStatusError:
        raise NoBBSError(f"{handle} isn't running a BBS.")
    except httpx.TransportError:
        raise NetworkError("Could not reach the network.")

    sv = site_record.value
    site_uri = str(AtUri(identity.did, lexicon.SITE, "self"))

    # Fetch boards, news, bans, and hidden posts concurrently
    board_slugs = sv["boards"]
    board_tasks = [
        get_record(client, identity.did, lexicon.BOARD, slug) for slug in board_slugs
    ]
    news_task = get_news(client, site_uri)
    ban_task = list_pds_records(client, identity.pds, identity.did, lexicon.BAN)
    hidden_task = list_pds_records(client, identity.pds, identity.did, lexicon.HIDE)

    results = await asyncio.gather(
        *board_tasks, news_task, ban_task, hidden_task, return_exceptions=True
    )
    board_records = results[: len(board_slugs)]
    news_result = results[len(board_slugs)]
    ban_result = results[len(board_slugs) + 1]
    hidden_result = results[len(board_slugs) + 2]

    boards = [
        Board(
            slug=slug,
            name=r.value["name"],
            description=r.value["description"],
            created_at=r.value["createdAt"],
            updated_at=r.value.get("updatedAt"),
        )
        for slug, r in zip(board_slugs, board_records)
        if not isinstance(r, BaseException)
    ]

    # Hydrate news records (only from the sysop's repo)
    if isinstance(news_result, BaseException):
        news_records = []
    else:
        sysop_news = [r for r in news_result.records if r.did == identity.did]
        news_records = await get_records_batch(client, sysop_news)
    news = [
        News(
            tid=AtUri.parse(r.uri).rkey,
            site_uri=r.value["site"],
            title=r.value["title"],
            body=r.value["body"],
            created_at=r.value["createdAt"],
            attachments=r.value.get("attachments"),
        )
        for r in news_records
    ]
    news.sort(key=lambda n: n.created_at, reverse=True)

    # Build ban/hidden sets from standalone records
    banned_dids: set[str] = set()
    if not isinstance(ban_result, BaseException):
        banned_dids = {r["value"]["did"] for r in ban_result}
    hidden_posts: set[str] = set()
    if not isinstance(hidden_result, BaseException):
        hidden_posts = {r["value"]["uri"] for r in hidden_result}

    site = Site(
        name=sv["name"],
        description=sv["description"],
        intro=sv["intro"],
        boards=boards,
        banned_dids=banned_dids,
        hidden_posts=hidden_posts,
        created_at=sv.get("createdAt", ""),
        updated_at=sv.get("updatedAt"),
    )

    return BBS(identity=identity, site=site, news=news)
