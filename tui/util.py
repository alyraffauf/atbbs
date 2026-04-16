"""TUI utilities."""

from core.auth.session import SessionStore


def require_session(screen) -> dict | None:
    """Return the user session if logged in, else notify and return None."""
    session = screen.app.user_session
    if not session:
        screen.notify("You must be logged in to do that.", severity="error")
        return None
    return session


def make_session_updater(store: SessionStore):
    """Create a session_updater callback for PDS write operations."""

    async def updater(did: str, field: str, value: str):
        store.update_session_field(did, field, value)

    return updater
