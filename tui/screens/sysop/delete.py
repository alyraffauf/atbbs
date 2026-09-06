import logging

from textual import work
from textual.app import ComposeResult
from textual.containers import Vertical
from textual.screen import Screen
from textual.widgets import Button, Footer, Static

from core import lexicon
from core.models import AtUri, BBS, make_at_uri
from core.constellation import get_root_posts
from core.pds import delete_record, list_pds_records
from tui.util import make_session_updater

logger = logging.getLogger(__name__)


class SysopDeleteScreen(Screen):
    BINDINGS = [("escape", "app.pop_screen", "cancel")]

    def __init__(self, bbs: BBS, handle: str) -> None:
        super().__init__()
        self.bbs = bbs
        self.handle = handle

    def compose(self) -> ComposeResult:
        with Vertical():
            yield Static("Delete your BBS?", classes="title")
            yield Static(
                "This will delete your site record, all boards, "
                "bans, and hidden post records. Posts from "
                "users will remain in their repos.",
            )
            yield Button("delete", id="delete-confirm", variant="error")
            yield Button("cancel", id="delete-cancel")
        yield Footer()

    def on_mount(self) -> None:
        self.query_one("#delete-cancel", Button).focus()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "delete-confirm":
            self._do_delete()
        else:
            self.app.pop_screen()

    @work(exclusive=True)
    async def _do_delete(self) -> None:
        session = self.app.user_session
        client = self.app.http_client
        updater = make_session_updater(self.app.session_store)

        failed = []

        for board in self.bbs.site.boards:
            try:
                await delete_record(client, session, lexicon.BOARD, board.slug, updater)
            except Exception as error:
                logger.exception(
                    "Board deletion failed",
                    extra={
                        "operation": "delete_board",
                        "handle": self.handle,
                        "route": board.slug,
                        "exception_type": type(error).__name__,
                    },
                )
                failed.append(f"board/{board.slug}")

        # Delete sysop's news posts (posts scoped to site)
        site_uri = make_at_uri(session["did"], lexicon.SITE, "self")
        try:
            cursor: str | None = None
            seen_cursors: set[str] = set()
            news_refs = []
            for _ in range(100):
                backlinks = await get_root_posts(
                    client, site_uri, limit=100, cursor=cursor, did=session["did"]
                )
                news_refs.extend(backlinks.records)
                cursor = backlinks.cursor
                if not cursor:
                    break
                if cursor in seen_cursors:
                    raise RuntimeError("Repeated news cursor")
                seen_cursors.add(cursor)
            else:
                raise RuntimeError("News listing exceeded 100 pages")
            for ref in news_refs:
                try:
                    await delete_record(client, session, lexicon.POST, ref.rkey, updater)
                except Exception as error:
                    logger.exception(
                        "News deletion failed",
                        extra={
                            "operation": "delete_news",
                            "handle": self.handle,
                            "route": ref.rkey,
                            "exception_type": type(error).__name__,
                        },
                    )
                    failed.append(f"post/{ref.rkey}")
        except Exception as error:
            logger.exception(
                "News listing failed",
                extra={
                    "operation": "list_news_for_delete",
                    "handle": self.handle,
                    "exception_type": type(error).__name__,
                },
            )
            failed.append("news lookup")

        for collection in (lexicon.BAN, lexicon.HIDE):
            try:
                records = await list_pds_records(
                    client, session["pds_url"], session["did"], collection
                )
                for record in records.require_complete():
                    rkey = AtUri.parse(record["uri"]).rkey
                    try:
                        await delete_record(client, session, collection, rkey, updater)
                    except Exception as error:
                        logger.exception(
                            "Moderation record deletion failed",
                            extra={
                                "operation": "delete_moderation",
                                "handle": self.handle,
                                "route": record["uri"],
                                "exception_type": type(error).__name__,
                            },
                        )
                        failed.append(f"{collection}/{rkey}")
            except Exception as error:
                logger.exception(
                    "Moderation listing failed",
                    extra={
                        "operation": "list_moderation_for_delete",
                        "handle": self.handle,
                        "route": collection,
                        "exception_type": type(error).__name__,
                    },
                )
                failed.append(f"{collection} lookup")

        if failed:
            self.notify(
                f"Could not delete: {', '.join(failed)}. Site record not deleted.",
                severity="error",
            )
            return

        try:
            await delete_record(client, session, lexicon.SITE, "self", updater)
        except Exception as error:
            logger.exception(
                "Site deletion failed",
                extra={
                    "operation": "delete_site",
                    "handle": self.handle,
                    "exception_type": type(error).__name__,
                },
            )
            self.notify("Could not delete site record.", severity="error")
            return

        self.notify("BBS deleted.")
        self.app.pop_screen()
        self.app.pop_screen()
        self.app.pop_screen()
