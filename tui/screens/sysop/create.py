import logging

from textual import work
from textual.app import ComposeResult
from textual.containers import VerticalScroll
from textual.screen import Screen
from textual.widgets import Footer, Input

from core import lexicon
from core.models import AuthError, make_at_uri
from core.pds import create_board_record, create_site_record, delete_record
from core.resolver import invalidate_bbs_cache, resolve_bbs
from core.util import now_iso
from tui.screens.sysop.bbs_form import BBSFormMixin, DEFAULT_BOARD
from tui.util import make_session_updater, require_session
from tui.widgets.breadcrumb import Breadcrumb

logger = logging.getLogger(__name__)


class SysopCreateScreen(BBSFormMixin, Screen):
    BINDINGS = [
        ("escape", "app.pop_screen", "back"),
        ("ctrl+s", "save", "save"),
        ("ctrl+n", "add_board", "add board"),
        ("ctrl+d", "remove_board", "remove board"),
    ]

    def __init__(self) -> None:
        super().__init__()
        self._boards = [{**DEFAULT_BOARD, "created_at": now_iso()}]

    def compose(self) -> ComposeResult:
        yield Breadcrumb(("@bbs", 1), ("create bbs", 0))
        with VerticalScroll(id="edit-scroll"):
            yield from self.compose_site_fields()
            yield from self.compose_board_widgets()
        yield Footer()

    def on_mount(self) -> None:
        self.query_one("#edit-name", Input).focus()

    def action_save(self) -> None:
        self._do_save()

    @work(exclusive=True)
    async def _do_save(self) -> None:
        session = require_session(self)
        if not session:
            return

        updater = make_session_updater(self.app.session_store)
        name, description, intro = self.get_site_field_values()

        if not self.validate_bbs_form(name, intro):
            return

        now = now_iso()
        board_values = self.get_board_values()
        created_slugs: list[str] = []

        try:
            for board in board_values:
                await create_board_record(
                    self.app.http_client,
                    session,
                    board["slug"],
                    board["name"],
                    board["description"],
                    board["created_at"] or now,
                    updater,
                )
                created_slugs.append(board["slug"])

            # Create the site record, referencing all board AT-URIs.
            await create_site_record(
                self.app.http_client,
                session,
                {
                    "$type": lexicon.SITE,
                    "name": name,
                    "description": description,
                    "intro": intro,
                    "boards": [
                        make_at_uri(session["did"], lexicon.BOARD, board["slug"])
                        for board in board_values
                    ],
                    "createdAt": now,
                },
                updater,
            )
            invalidate_bbs_cache()
            self.notify("BBS created!")

            # Navigate to the new BBS so the user lands on it.
            handle = session.get("handle", "")
            self.app.pop_screen()
            bbs = await resolve_bbs(self.app.http_client, handle)

            from tui.screens.site import SiteScreen

            self.app.push_screen(SiteScreen(bbs, handle))
        except AuthError:
            self.notify("Session expired. Please log in again.", severity="error")
        except Exception as error:
            logger.exception(
                "BBS creation failed",
                extra={
                    "operation": "create_bbs",
                    "handle": session["handle"],
                    "exception_type": type(error).__name__,
                },
            )
            for slug in reversed(created_slugs):
                try:
                    await delete_record(
                        self.app.http_client, session, lexicon.BOARD, slug, updater
                    )
                except Exception:
                    pass
            self.notify("Could not create BBS.", severity="error")
