from core.models import AtUri, Record


def filter_moderated(
    records: list[Record], banned_dids: set[str], hidden_posts: set[str]
) -> list[Record]:
    """Remove records from banned users or hidden by the sysop."""
    return [
        record
        for record in records
        if AtUri.parse(record.uri).did not in banned_dids
        and record.uri not in hidden_posts
    ]
