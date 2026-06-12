from textual.app import ComposeResult
from textual.screen import Screen
from textual.widgets import Footer, ListItem, ListView, Static

from core.models import BBS
from tui.screens.sysop.delete import SysopDeleteScreen
from tui.screens.sysop.edit import SysopEditScreen
from tui.screens.sysop.moderate import SysopModerateScreen


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
            self.app.push_screen(SysopEditScreen(self.bbs, self.handle))
        elif name == "moderate":
            self.app.push_screen(SysopModerateScreen(self.bbs, self.handle))
        elif name == "delete":
            self.app.push_screen(SysopDeleteScreen(self.bbs, self.handle))
