from textual import work
from textual.app import ComposeResult
from textual.containers import Vertical
from textual.screen import Screen
from textual.widgets import Footer, Input, Static, TextArea

from core import lexicon, limits
from core.models import AtUri, AuthError, BBS
from core.records import create_post_record
from tui.util import require_session
from tui.widgets.breadcrumb import Breadcrumb
from tui.screens.compose.upload import upload_file


class ComposeNewsScreen(Screen):
    BINDINGS = [
        ("escape", "app.pop_screen", "back"),
        ("ctrl+s", "post", "post"),
    ]

    def __init__(self, bbs: BBS, handle: str) -> None:
        super().__init__()
        self.bbs = bbs
        self.handle = handle

    def compose(self) -> ComposeResult:
        yield Breadcrumb(
            ("@bbs", 2),
            (self.bbs.site.name, 1),
            ("news", 0),
        )
        with Vertical():
            yield Static("news", classes="title")
            yield Input(
                placeholder="Title", id="news-title", max_length=limits.POST_TITLE
            )
            yield TextArea(id="news-body", language=None)
            yield Input(placeholder="attach file (path, optional)", id="news-file")
        yield Footer()

    def on_mount(self) -> None:
        self.query_one("#news-title", Input).focus()

    def action_post(self) -> None:
        self.post_news()

    @work(exclusive=True)
    async def post_news(self) -> None:
        session = require_session(self)
        if not session:
            return

        title = self.query_one("#news-title", Input).value.strip()
        body = self.query_one("#news-body", TextArea).text.strip()
        if not title or not body:
            self.notify("Title and body cannot be empty.", severity="error")
            return
        if len(body) > limits.POST_BODY:
            self.notify(
                f"Body too long ({len(body)}/{limits.POST_BODY}).", severity="error"
            )
            return

        site_uri = str(AtUri(self.bbs.identity.did, lexicon.SITE, "self"))

        attachments = []
        file_path = self.query_one("#news-file", Input).value.strip()
        if file_path:
            attachments = await upload_file(self, file_path, session)
            if attachments is None:
                return

        try:
            resp = await create_post_record(
                self.app.http_client,
                session,
                scope=site_uri,
                body=body,
                title=title,
                attachments=attachments or None,
            )
            resp.raise_for_status()
        except AuthError:
            self.notify("Session expired. Please log in again.", severity="error")
            return
        except Exception as error:
            self.notify(f"Failed to post news: {error}", severity="error")
            return

        self.app.pop_screen()
