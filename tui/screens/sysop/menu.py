from textual.app import ComposeResult
from textual.screen import Screen
from textual.widgets import Footer, ListItem, ListView, Static

from core.models import BBS


class SysopScreen(Screen):
    BINDINGS = [("escape", "app.pop_screen", "back")]

    def __init__(self, bbs: BBS, handle: str) -> None:
        super().__init__()
        self.bbs = bbs
        self.handle = handle

    def compose(self) -> ComposeResult:
        yield ListView(
            ListItem(Static("  Edit BBS"), name="edit"),
            ListItem(Static("  Moderation"), name="moderate"),
            ListItem(Static("  Delete BBS"), name="delete"),
            id="sysop-menu",
        )
        yield Footer()

    def on_mount(self) -> None:
        self.query_one("#sysop-menu", ListView).focus()

    def on_list_view_selected(self, event: ListView.Selected) -> None:
        name = event.item.name
        if name == "edit":
            from tui.screens.sysop.edit import SysopEditScreen
            self.app.push_screen(SysopEditScreen(self.bbs, self.handle))
        elif name == "moderate":
            from tui.screens.sysop.moderate import SysopModerateScreen
            self.app.push_screen(SysopModerateScreen(self.bbs, self.handle))
        elif name == "delete":
            from tui.screens.sysop.delete import SysopDeleteScreen
            self.app.push_screen(SysopDeleteScreen(self.bbs, self.handle))
