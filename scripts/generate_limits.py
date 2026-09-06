"""Generate client limit constants from the AT Protocol lexicons."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def load(name: str) -> dict:
    return json.loads((ROOT / "lexicons" / f"xyz.atbbs.{name}.json").read_text())


site = load("site")["defs"]["main"]["record"]["properties"]
board = load("board")["defs"]["main"]["record"]["properties"]
post_document = load("post")
post = post_document["defs"]["main"]["record"]["properties"]
attachment = post_document["defs"]["attachment"]["properties"]
profile = load("profile")["defs"]["main"]["record"]["properties"]

values = {
    "SITE_NAME": site["name"]["maxLength"],
    "SITE_DESCRIPTION": site["description"]["maxLength"],
    "SITE_INTRO": site["intro"]["maxLength"],
    "MAX_BOARDS": site["boards"]["maxLength"],
    "BOARD_NAME": board["name"]["maxLength"],
    "BOARD_SLUG": 50,
    "BOARD_DESCRIPTION": board["description"]["maxLength"],
    "POST_TITLE": post["title"]["maxLength"],
    "POST_BODY": post["body"]["maxLength"],
    "ATTACHMENT_NAME": attachment["name"]["maxLength"],
    "MAX_ATTACHMENTS": post["attachments"]["maxLength"],
    "MAX_ATTACHMENT_BYTES": attachment["file"]["maxSize"],
    "MAX_IMAGE_PIXELS": 40_000_000,
    "PROFILE_NAME": profile["name"]["maxLength"],
    "PROFILE_PRONOUNS": profile["pronouns"]["maxLength"],
    "PROFILE_BIO": profile["bio"]["maxLength"],
}

python_lines = [
    '"""Generated from lexicons. Run `just lex` after editing them."""',
    "",
    *(f"{name} = {value:_}" for name, value in values.items()),
    "",
]
(ROOT / "core" / "limits.py").write_text("\n".join(python_lines))

typescript_lines = [
    "/** Generated from lexicons. Run `just lex` after editing them. */",
    "",
    *(f"export const {name} = {value:_};" for name, value in values.items()),
    "",
]
(ROOT / "web" / "src" / "lib" / "limits.ts").write_text(
    "\n".join(typescript_lines)
)
