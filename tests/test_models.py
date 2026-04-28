import pytest

from core.models import AtUri, BacklinkRef, MiniDoc, Post, make_at_uri


URI = "at://did:plc:abc/xyz.atbbs.post/3lkw1"


def test_aturi_parse_fields():
    parsed = AtUri.parse(URI)
    assert parsed.did == "did:plc:abc"
    assert parsed.collection == "xyz.atbbs.post"
    assert parsed.rkey == "3lkw1"


def test_aturi_str_from_constructor():
    assert str(AtUri("did:plc:abc", "xyz.atbbs.post", "3lkw1")) == URI


def test_make_at_uri():
    assert make_at_uri("did:plc:abc", "xyz.atbbs.post", "3lkw1") == URI


def test_make_at_uri_roundtrips_through_parse():
    uri = make_at_uri("did:plc:abc", "xyz.atbbs.post", "3lkw1")
    parsed = AtUri.parse(uri)
    assert parsed.did == "did:plc:abc"
    assert parsed.collection == "xyz.atbbs.post"
    assert parsed.rkey == "3lkw1"


def test_aturi_str_roundtrip():
    assert str(AtUri.parse(URI)) == URI


def test_aturi_eq_with_string():
    assert AtUri.parse(URI) == URI


def test_aturi_eq_with_string_reverse():
    assert URI == AtUri.parse(URI)


def test_aturi_eq_with_aturi():
    assert AtUri.parse(URI) == AtUri.parse(URI)


@pytest.mark.parametrize("other", [42, None, [], {}, 3.14, object()])
def test_aturi_eq_other_type_is_false(other):
    assert (AtUri.parse(URI) == other) is False


def test_aturi_hash_consistent_with_equality():
    a = AtUri.parse(URI)
    b = AtUri.parse(URI)
    assert a == b
    assert hash(a) == hash(b)


def test_aturi_hash_set_membership():
    seen = {AtUri.parse(URI)}
    assert AtUri.parse(URI) in seen


@pytest.mark.parametrize(
    "bad_uri",
    [
        "https://example.com/x/y/z",
        "did:plc:abc/xyz.atbbs.post/3lkw1",
        "at://did:plc:abc/xyz.atbbs.post",
        "at://did:plc:abc/xyz.atbbs.post/3lkw1/extra",
        "at://did:plc:abc//3lkw1",
        "at:///xyz.atbbs.post/3lkw1",
        "",
    ],
)
def test_aturi_parse_rejects_malformed(bad_uri):
    with pytest.raises(ValueError):
        AtUri.parse(bad_uri)


def test_backlinkref_uri():
    ref = BacklinkRef(did="did:plc:abc", collection="xyz.atbbs.post", rkey="3lkw1")
    assert ref.uri == URI


def _post(root=None):
    return Post(
        uri=URI,
        scope="board",
        body="hi",
        created_at="2024-01-15T12:30:00+00:00",
        author=MiniDoc(did="did:plc:abc", handle="alice.test"),
        root=root,
    )


def test_post_is_root_when_no_root():
    assert _post(root=None).is_root is True


def test_post_is_root_false_when_root_set():
    assert _post(root="at://did:plc:abc/xyz.atbbs.post/parent").is_root is False
