"""Base class for all compose screens (thread, news, reply).

Handles the shared post workflow: session check, body/title validation,
file upload, API call, error handling, and navigation on success.

Subclasses define their own ``compose()`` layout using these widget IDs:
    - ``#compose-title`` — optional Input (only if ``requires_title = True``)
    - ``#compose-body``  — required TextArea
    - ``#compose-file``  — optional Input for a file path

Subclasses must override ``get_post_params()`` to return the keyword
arguments passed to ``create_post_record``.
"""

from textual import work
from textual.screen import Screen
from textual.widgets import Input, TextArea

from core import limits
from core.models import AuthError
from core.records import create_post_record
from tui.screens.compose.upload import upload_file
from tui.util import require_session


class ComposeScreen(Screen):
    BINDINGS = [
        ("escape", "app.pop_screen", "back"),
        ("ctrl+s", "post", "post"),
    ]

    # Subclasses set these to control validation behavior.
    requires_title: bool = False
    post_type: str = "post"  # used in error messages, e.g. "Failed to post thread"

    def get_post_params(self, title: str | None, body: str) -> dict:
        """Return keyword arguments for ``create_post_record``.

        Called after validation passes. *title* is ``None`` when
        ``requires_title`` is ``False``.
        """
        raise NotImplementedError

    def action_post(self) -> None:
        self._do_post()

    @work(exclusive=True)
    async def _do_post(self) -> None:
        session = require_session(self)
        if not session:
            return

        # -- Read form values ------------------------------------------------
        title = None
        if self.requires_title:
            title = self.query_one("#compose-title", Input).value.strip()

        body = self.query_one("#compose-body", TextArea).text.strip()

        # -- Validate --------------------------------------------------------
        if self.requires_title and not title:
            self.notify("Title cannot be empty.", severity="error")
            return
        if not body:
            self.notify("Body cannot be empty.", severity="error")
            return
        if len(body) > limits.POST_BODY:
            self.notify(
                f"Body too long ({len(body)}/{limits.POST_BODY}).", severity="error"
            )
            return

        # -- Upload attachment (if any) --------------------------------------
        attachments = []
        file_path = self.query_one("#compose-file", Input).value.strip()
        if file_path:
            attachments = await upload_file(self, file_path, session)
            if attachments is None:
                return  # upload_file already notified the user

        # -- Create the post record ------------------------------------------
        params = self.get_post_params(title, body)
        try:
            resp = await create_post_record(
                self.app.http_client,
                session,
                attachments=attachments or None,
                **params,
            )
            resp.raise_for_status()
        except AuthError:
            self.notify("Session expired. Please log in again.", severity="error")
            return
        except Exception as error:
            self.notify(f"Failed to post {self.post_type}: {error}", severity="error")
            return

        self.app.pop_screen()
