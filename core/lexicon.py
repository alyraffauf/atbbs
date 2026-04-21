"""AT Protocol collection names for atbbs lexicons."""

from core.shared import LEXICON_COLLECTIONS, OAUTH_BASE_SCOPES

SITE = LEXICON_COLLECTIONS["site"]
BOARD = LEXICON_COLLECTIONS["board"]
POST = LEXICON_COLLECTIONS["post"]
BAN = LEXICON_COLLECTIONS["ban"]
HIDE = LEXICON_COLLECTIONS["hide"]
PIN = LEXICON_COLLECTIONS["pin"]
PROFILE = LEXICON_COLLECTIONS["profile"]

OAUTH_SCOPE = " ".join(
    [*OAUTH_BASE_SCOPES, *(f"repo:{nsid}" for nsid in LEXICON_COLLECTIONS.values())]
)
