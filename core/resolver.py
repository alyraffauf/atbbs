import asyncio

import httpx

from core.models import (
    AtUri,
    BBS,
    Board,
    Post,
    Site,
    BBSNotFoundError,
    NoBBSError,
    NetworkError,
    UnsupportedRecordError,
    make_at_uri,
)
from core import lexicon
from core.cache import TTLCache
from core.constellation import get_root_posts
from core.hydration import post_from_record
from core.pds import list_pds_records
from core.slingshot import (
    get_record,
    get_records_batch,
    get_records_by_uri,
    resolve_identity,
)
from core.limits import MAX_BOARDS

_bbs_cache = TTLCache(ttl_seconds=300)  # 5 minutes
_moderation_cache = TTLCache(ttl_seconds=3_600)


def invalidate_bbs_cache():
    _bbs_cache.clear()


async def resolve_bbs(client: httpx.AsyncClient, handle: str) -> BBS:
    cached = _bbs_cache.get(handle)
    if cached:
        return cached
    bbs = await _resolve_bbs(client, handle)
    _bbs_cache.set(handle, bbs)
    return bbs


async def _resolve_bbs(client: httpx.AsyncClient, handle: str) -> BBS:
    """Handle -> fully resolved BBS config."""
    try:
        identity = await resolve_identity(client, handle)
    except httpx.HTTPStatusError as error:
        if error.response.status_code == 404:
            raise BBSNotFoundError(f"Could not resolve handle: {handle}") from error
        raise NetworkError(
            f"Identity service returned HTTP {error.response.status_code}."
        ) from error
    except httpx.TransportError:
        raise NetworkError("Could not reach the network.")

    try:
        site_record = await get_record(client, identity.did, lexicon.SITE, "self")
    except httpx.HTTPStatusError as error:
        if error.response.status_code == 404:
            raise NoBBSError(f"{handle} isn't running a BBS.") from error
        raise NetworkError(
            f"Record service returned HTTP {error.response.status_code}."
        ) from error
    except httpx.TransportError:
        raise NetworkError("Could not reach the network.")

    site_value = site_record.value
    site_uri = make_at_uri(identity.did, lexicon.SITE, "self")

    # Fetch boards and news concurrently
    board_uris = site_value["boards"]
    if len(board_uris) > MAX_BOARDS:
        raise UnsupportedRecordError(
            f"This BBS has more than the supported {MAX_BOARDS} boards."
        )
    for uri in board_uris:
        parsed = AtUri.parse(uri)
        if parsed.did != identity.did or parsed.collection != lexicon.BOARD:
            raise UnsupportedRecordError("Site record references a foreign board.")
    news_task = get_root_posts(client, site_uri, did=identity.did)

    moderation_stale = False
    try:
        if not identity.pds:
            raise NetworkError("Could not locate the BBS PDS.")
        ban_result, hide_result = await asyncio.gather(
            list_pds_records(client, identity.pds, identity.did, lexicon.BAN),
            list_pds_records(client, identity.pds, identity.did, lexicon.HIDE),
        )
        bans = ban_result.require_complete()
        hides = hide_result.require_complete()
        moderation = (
            {
                record["value"]["did"]
                for record in bans
                if record.get("value", {}).get("did")
            },
            {
                record["value"]["uri"]
                for record in hides
                if record.get("value", {}).get("uri")
            },
        )
        _moderation_cache.set(identity.did, moderation)
    except Exception:
        moderation = _moderation_cache.get(identity.did)
        if moderation is None:
            raise NetworkError("Could not verify BBS moderation state.") from None
        moderation_stale = True
    banned_dids, hidden_posts = moderation

    board_records, news_result = await asyncio.gather(
        get_records_by_uri(client, board_uris), news_task, return_exceptions=True
    )
    if isinstance(board_records, BaseException):
        board_records = []

    boards = []
    for record in board_records:
        parsed = AtUri.parse(record.uri)
        boards.append(
            Board(
                slug=parsed.rkey,
                name=record.value["name"],
                description=record.value["description"],
                created_at=record.value["createdAt"],
                updated_at=record.value.get("updatedAt"),
            )
        )

    # Hydrate news posts (only from the sysop's repo — server-side filtered)
    if isinstance(news_result, BaseException):
        news_records = []
    else:
        news_records = await get_records_batch(client, news_result.records)
    news = [
        post_from_record(record, identity)
        for record in news_records
        if record.uri not in hidden_posts
    ]
    news.sort(key=lambda post: post.created_at, reverse=True)

    site = Site(
        name=site_value["name"],
        description=site_value["description"],
        intro=site_value["intro"],
        boards=boards,
        created_at=site_value.get("createdAt", ""),
        updated_at=site_value.get("updatedAt"),
    )

    return BBS(
        identity=identity,
        site=site,
        news=news,
        banned_dids=banned_dids,
        hidden_posts=hidden_posts,
        moderation_stale=moderation_stale,
    )
