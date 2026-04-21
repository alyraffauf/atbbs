"""Input widget with cycling AT Protocol handle placeholders."""

from textual.widgets import Input

from core.shared import HANDLE_PLACEHOLDERS as PLACEHOLDERS


class HandleInput(Input):
    """An Input that cycles through example AT Protocol handles as placeholder text."""

    def __init__(self, **kwargs) -> None:
        kwargs.setdefault("placeholder", PLACEHOLDERS[0])
        super().__init__(**kwargs)
        self._placeholder_index = 0

    def on_mount(self) -> None:
        self.set_interval(6, self._cycle_placeholder)

    def _cycle_placeholder(self) -> None:
        # Don't cycle if the user has typed something.
        if self.value:
            return
        self._placeholder_index = (self._placeholder_index + 1) % len(PLACEHOLDERS)
        self.placeholder = PLACEHOLDERS[self._placeholder_index]
