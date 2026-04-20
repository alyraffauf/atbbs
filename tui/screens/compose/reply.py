from textual.app import ComposeResult
from textual.containers import Vertical
from textual.widgets import Footer, Input, Static, TextArea

from core.models import BBS, Post as PostModel
from tui.screens.compose.base import ComposeScreen
from tui.widgets.breadcrumb import Breadcrumb


class ComposeReplyScreen(ComposeScreen):
    requires_title = False
    post_type = "reply"

    BINDINGS = [
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
            yield TextArea(id="compose-body", language=None)
            yield Input(placeholder="attach file (path, optional)", id="compose-file")
        yield Footer()

    def on_mount(self) -> None:
        self.query_one("#compose-body", TextArea).focus()

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
                before=self.query_one("#compose-body"),
            )

    def get_post_params(self, title: str | None, body: str) -> dict:
        return {
            "scope": self.thread.scope,
            "body": body,
            "root": self.thread.uri,
            "parent": self.parent_post.uri if self.parent_post else None,
        }
