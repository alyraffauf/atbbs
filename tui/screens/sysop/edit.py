from textual import work
from textual.app import ComposeResult
from textual.containers import VerticalScroll
from textual.screen import Screen
from textual.widgets import Footer, Input, Static, TextArea

from core import lexicon, limits
from core.models import AtUri, AuthError, BBS
from core.records import delete_record, put_board_record, put_site_record
from core.resolver import invalidate_bbs_cache
from core.util import now_iso
from tui.util import make_session_updater, require_session
from tui.widgets.breadcrumb import Breadcrumb


class SysopEditScreen(Screen):
    BINDINGS = [
        ("escape", "app.pop_screen", "back"),
        ("ctrl+s", "save", "save"),
        ("ctrl+n", "add_board", "add board"),
        ("ctrl+d", "remove_board", "remove board"),
    ]

    def __init__(self, bbs: BBS, handle: str) -> None:
        super().__init__()
        self.bbs = bbs
        self.handle = handle
        self._boards = [
            {
                "slug": board.slug,
                "name": board.name,
                "description": board.description,
                "created_at": board.created_at,
            }
            for board in bbs.site.boards
        ]

    def compose(self) -> ComposeResult:
        yield Breadcrumb(
            ("@bbs", 3),
            (self.bbs.site.name, 2),
            ("sysop", 1),
            ("edit", 0),
        )
        with VerticalScroll(id="edit-scroll"):
            yield Static("NAME", classes="section-label")
            yield Input(
                value=self.bbs.site.name, id="edit-name", max_length=limits.SITE_NAME
            )
            yield Static("DESCRIPTION", classes="section-label")
            yield Input(
                value=self.bbs.site.description,
                id="edit-desc",
                max_length=limits.SITE_DESCRIPTION,
            )
            yield Static("INTRO", classes="section-label")
            yield TextArea(self.bbs.site.intro, id="edit-intro", language=None)
            yield Static(
                "BOARDS (ctrl+n add, ctrl+d remove)",
                classes="section-label",
                id="boards-label",
            )
            for board in self._boards:
                yield Static(
                    f"  {board['slug']}",
                    classes="subtitle",
                    id=f"board-label-{board['slug']}",
                )
                yield Input(
                    value=board["name"],
                    id=f"board-name-{board['slug']}",
                    max_length=limits.BOARD_NAME,
                )
                yield Input(
                    value=board["description"],
                    id=f"board-desc-{board['slug']}",
                    max_length=limits.BOARD_DESCRIPTION,
                )
        yield Footer()

    def on_mount(self) -> None:
        self.query_one("#edit-name", Input).focus()

    def action_add_board(self) -> None:
        index = len(self._boards) + 1
        while any(board["slug"] == f"board-{index}" for board in self._boards):
            index += 1
        slug = f"board-{index}"
        self._boards.append(
            {"slug": slug, "name": slug, "description": "", "created_at": now_iso()}
        )

        scroll = self.query_one("#edit-scroll", VerticalScroll)
        label = Static(f"  {slug}", classes="subtitle", id=f"board-label-{slug}")
        name_input = Input(
            value=slug, id=f"board-name-{slug}", max_length=limits.BOARD_NAME
        )
        desc_input = Input(
            value="", id=f"board-desc-{slug}", max_length=limits.BOARD_DESCRIPTION
        )
        scroll.mount(label)
        scroll.mount(name_input)
        scroll.mount(desc_input)
        name_input.focus()

    def action_remove_board(self) -> None:
        if len(self._boards) <= 1:
            self.notify("Must have at least one board.", severity="warning")
            return
        board = self._boards.pop()
        slug = board["slug"]
        for widget_id in (
            f"board-label-{slug}",
            f"board-name-{slug}",
            f"board-desc-{slug}",
        ):
            try:
                self.query_one(f"#{widget_id}").remove()
            except Exception:
                pass

    def action_save(self) -> None:
        self._do_save()

    @work(exclusive=True)
    async def _do_save(self) -> None:
        session = require_session(self)
        if not session:
            return

        updater = make_session_updater(self.app.session_store)

        name = self.query_one("#edit-name", Input).value.strip()
        description = self.query_one("#edit-desc", Input).value.strip()
        intro = self.query_one("#edit-intro", TextArea).text

        if not name:
            self.notify("Name cannot be empty.", severity="error")
            return
        if len(intro) > limits.SITE_INTRO:
            self.notify(
                f"Intro too long ({len(intro)}/{limits.SITE_INTRO}).",
                severity="error",
            )
            return

        now = now_iso()

        try:
            for board in self._boards:
                board_name = self.query_one(
                    f"#board-name-{board['slug']}", Input
                ).value.strip()
                board_desc = self.query_one(
                    f"#board-desc-{board['slug']}", Input
                ).value.strip()
                await put_board_record(
                    self.app.http_client,
                    session,
                    board["slug"],
                    board_name or board["slug"],
                    board_desc,
                    board["created_at"],
                    updater,
                )

            current_slugs = {board["slug"] for board in self._boards}
            for board in self.bbs.site.boards:
                if board.slug not in current_slugs:
                    await delete_record(
                        self.app.http_client,
                        session,
                        lexicon.BOARD,
                        board.slug,
                        updater,
                    )

            await put_site_record(
                self.app.http_client,
                session,
                {
                    "$type": lexicon.SITE,
                    "name": name,
                    "description": description,
                    "intro": intro,
                    "boards": [
                        str(AtUri(session["did"], lexicon.BOARD, board["slug"]))
                        for board in self._boards
                    ],
                    "createdAt": self.bbs.site.created_at or now,
                    "updatedAt": now,
                },
                updater,
            )
            invalidate_bbs_cache()
            self.notify("BBS updated.")
            self.app.pop_screen()
        except AuthError:
            self.notify("Session expired. Please log in again.", severity="error")
        except Exception as e:
            self.notify(f"Could not update BBS: {e}", severity="error")
