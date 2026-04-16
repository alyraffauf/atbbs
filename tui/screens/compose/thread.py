from textual import work
from textual.app import ComposeResult
from textual.containers import Vertical
from textual.screen import Screen
from textual.widgets import Footer, Input, Static, TextArea

from core import lexicon, limits
from core.models import AtUri, AuthError, BBS, Board
from core.records import create_post_record
from tui.util import require_session
from tui.widgets.breadcrumb import Breadcrumb
from tui.screens.compose.upload import upload_file


class ComposeThreadScreen(Screen):
    BINDINGS = [
        ("escape", "app.pop_screen", "back"),
        ("ctrl+s", "post", "post"),
    ]

    def __init__(self, bbs: BBS, handle: str, board: Board) -> None:
        super().__init__()
        self.bbs = bbs
        self.handle = handle
        self.board = board

    def compose(self) -> ComposeResult:
        yield Breadcrumb(
            ("@bbs", 3),
            (self.bbs.site.name, 2),
            (self.board.name, 1),
            ("new thread", 0),
        )
        with Vertical():
            yield Static("new thread", classes="title")
            yield Input(
                placeholder="Thread title",
                id="thread-title",
                max_length=limits.POST_TITLE,
            )
            yield TextArea(id="thread-body", language=None)
            yield Input(placeholder="attach file (path, optional)", id="thread-file")
        yield Footer()

    def on_mount(self) -> None:
        self.query_one("#thread-title", Input).focus()

    def action_post(self) -> None:
        self.post_thread()

    @work(exclusive=True)
    async def post_thread(self) -> None:
        session = require_session(self)
        if not session:
            return

        title = self.query_one("#thread-title", Input).value.strip()
        body = self.query_one("#thread-body", TextArea).text.strip()
        if not title or not body:
            self.notify("Title and body cannot be empty.", severity="error")
            return
        if len(body) > limits.POST_BODY:
            self.notify(
                f"Body too long ({len(body)}/{limits.POST_BODY}).", severity="error"
            )
            return

        board_uri = str(AtUri(self.bbs.identity.did, lexicon.BOARD, self.board.slug))

        attachments = []
        file_path = self.query_one("#thread-file", Input).value.strip()
        if file_path:
            attachments = await upload_file(self, file_path, session)
            if attachments is None:
                return

        try:
            resp = await create_post_record(
                self.app.http_client,
                session,
                scope=board_uri,
                body=body,
                title=title,
                attachments=attachments or None,
            )
            resp.raise_for_status()
        except AuthError:
            self.notify("Session expired. Please log in again.", severity="error")
            return
        except Exception as error:
            self.notify(f"Failed to post thread: {error}", severity="error")
            return

        self.app.pop_screen()
