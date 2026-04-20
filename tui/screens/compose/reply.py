from textual import work
from textual.app import ComposeResult
from textual.containers import Vertical
from textual.screen import Screen
from textual.widgets import Footer, Input, Static, TextArea

from core import limits
from core.models import AuthError, BBS, Post as PostModel
from core.records import create_post_record
from tui.util import require_session
from tui.widgets.breadcrumb import Breadcrumb
from tui.screens.compose.upload import upload_file


class ComposeReplyScreen(Screen):
    BINDINGS = [
        ("escape", "app.pop_screen", "back"),
        ("ctrl+s", "post", "post"),
        ("ctrl+g", "toggle_reply_to", "toggle reply to"),
    ]

    def __init__(
        self, bbs: BBS, handle: str, thread: PostModel, parent: PostModel | None = None
    ) -> None:
        super().__init__()
        self.bbs = bbs
        self.handle = handle
        self.original_parent = parent
        self.parent_post = parent
        self.thread = thread

    def compose(self) -> ComposeResult:
        yield Breadcrumb(
            ("@bbs", 3),
            (self.bbs.site.name, 2),
            (self.thread.title or "", 1),
            ("reply", 0),
        )
        with Vertical():
            yield Static(f"thread: {self.thread.title}", classes="title")
            if self.parent_post:
                body_preview = self.parent_post.body[:60] + (
                    "..." if len(self.parent_post.body) > 60 else ""
                )
                yield Static(
                    f"replying to {self.parent_post.author.handle}: {body_preview}",
                    classes="subtitle",
                    id="reply-to-info",
                )
            yield TextArea(id="reply-body", language=None)
            yield Input(placeholder="attach file (path, optional)", id="reply-file")
        yield Footer()

    def on_mount(self) -> None:
        self.query_one("#reply-body", TextArea).focus()

    def action_toggle_reply_to(self) -> None:
        if not self.original_parent:
            return
        if self.parent_post:
            self.parent_post = None
            for widget in self.query("#reply-to-info"):
                widget.remove()
        else:
            self.parent_post = self.original_parent
            body_preview = self.parent_post.body[:60] + (
                "..." if len(self.parent_post.body) > 60 else ""
            )
            container = self.query_one(Vertical)
            container.mount(
                Static(
                    f"replying to {self.parent_post.author.handle}: {body_preview}",
                    classes="subtitle",
                    id="reply-to-info",
                ),
                before=self.query_one("#reply-body"),
            )

    def action_post(self) -> None:
        self.post_reply()

    @work(exclusive=True)
    async def post_reply(self) -> None:
        session = require_session(self)
        if not session:
            return

        body = self.query_one("#reply-body", TextArea).text.strip()
        if not body:
            self.notify("Message body cannot be empty.", severity="error")
            return
        if len(body) > limits.POST_BODY:
            self.notify(
                f"Body too long ({len(body)}/{limits.POST_BODY}).", severity="error"
            )
            return

        attachments = []
        file_path = self.query_one("#reply-file", Input).value.strip()
        if file_path:
            attachments = await upload_file(self, file_path, session)
            if attachments is None:
                return

        try:
            resp = await create_post_record(
                self.app.http_client,
                session,
                scope=self.thread.scope,
                body=body,
                root=self.thread.uri,
                parent=self.parent_post.uri if self.parent_post else None,
                attachments=attachments or None,
            )
            resp.raise_for_status()
        except AuthError:
            self.notify("Session expired. Please log in again.", severity="error")
            return
        except Exception as error:
            self.notify(f"Failed to post reply: {error}", severity="error")
            return

        self.app.pop_screen()
