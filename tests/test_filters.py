import pytest

from core.filters import filter_moderated
from core.models import Record


def _record(did: str, rkey: str) -> Record:
    uri = f"at://{did}/xyz.atbbs.post/{rkey}"
    return Record(uri=uri, cid="bafy", value={})


def test_filter_drops_banned_dids():
    records = [_record("did:plc:alice", "1"), _record("did:plc:eve", "2")]
    out = filter_moderated(records, banned_dids={"did:plc:eve"}, hidden_posts=set())
    assert [r.uri for r in out] == ["at://did:plc:alice/xyz.atbbs.post/1"]


def test_filter_drops_hidden_posts():
    a = _record("did:plc:alice", "1")
    b = _record("did:plc:alice", "2")
    out = filter_moderated([a, b], banned_dids=set(), hidden_posts={b.uri})
    assert out == [a]


def test_filter_combines_both_rules():
    a = _record("did:plc:alice", "1")
    b = _record("did:plc:alice", "hidden")
    c = _record("did:plc:eve", "3")
    out = filter_moderated(
        [a, b, c], banned_dids={"did:plc:eve"}, hidden_posts={b.uri}
    )
    assert out == [a]


def test_filter_no_rules_passes_through():
    records = [_record("did:plc:alice", "1"), _record("did:plc:bob", "2")]
    assert filter_moderated(records, banned_dids=set(), hidden_posts=set()) == records


def test_filter_empty_records():
    assert filter_moderated([], banned_dids={"did:plc:eve"}, hidden_posts=set()) == []


def test_filter_propagates_malformed_uri():
    """Malformed records are a programmer error upstream — fail loud, don't silently drop."""
    bad = Record(uri="not-an-at-uri", cid="bafy", value={})
    with pytest.raises(ValueError):
        filter_moderated([bad], banned_dids=set(), hidden_posts=set())
