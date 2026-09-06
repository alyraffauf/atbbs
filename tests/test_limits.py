import json
from pathlib import Path

from core import limits


def test_board_limit_matches_site_lexicon():
    lexicon_path = Path(__file__).parent.parent / "lexicons" / "xyz.atbbs.site.json"
    site_schema = json.loads(lexicon_path.read_text())
    boards = site_schema["defs"]["main"]["record"]["properties"]["boards"]

    assert limits.MAX_BOARDS == 50
    assert boards["maxLength"] == limits.MAX_BOARDS
