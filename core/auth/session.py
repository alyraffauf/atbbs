"""Typed OAuth session storage backed by SQLite."""

from __future__ import annotations

import os
import sqlite3
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterator, Mapping


SCHEMA = """
CREATE TABLE IF NOT EXISTS oauth_auth_request (
    state TEXT NOT NULL PRIMARY KEY,
    authserver_iss TEXT NOT NULL,
    did TEXT,
    handle TEXT,
    pds_url TEXT,
    pkce_verifier TEXT NOT NULL,
    scope TEXT NOT NULL,
    dpop_authserver_nonce TEXT NOT NULL,
    dpop_private_jwk TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_session (
    did TEXT NOT NULL PRIMARY KEY,
    handle TEXT,
    pds_url TEXT NOT NULL,
    authserver_iss TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    dpop_authserver_nonce TEXT NOT NULL,
    dpop_pds_nonce TEXT,
    dpop_private_jwk TEXT NOT NULL,
    client_id TEXT
);
"""


@dataclass(slots=True)
class OAuthSession(Mapping[str, Any]):
    """An OAuth session whose mutable credentials are owned by SessionStore."""

    did: str
    handle: str | None
    pds_url: str
    authserver_iss: str
    access_token: str | None
    refresh_token: str | None
    dpop_authserver_nonce: str
    dpop_pds_nonce: str | None
    dpop_private_jwk: str
    client_id: str | None

    def __getitem__(self, key: str) -> Any:
        if key not in self.__dataclass_fields__:
            raise KeyError(key)
        return getattr(self, key)

    def __iter__(self) -> Iterator[str]:
        return iter(self.__dataclass_fields__)

    def __len__(self) -> int:
        return len(self.__dataclass_fields__)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)

    def _set_pds_nonce(self, nonce: str) -> None:
        self.dpop_pds_nonce = nonce

    def _set_tokens(self, access_token: str, refresh_token: str, nonce: str) -> None:
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.dpop_authserver_nonce = nonce


class SessionStore:
    """Own OAuth sessions and persist each credential change atomically."""

    def __init__(self, db_path: str = "atbbs.db"):
        self.db_path = db_path
        self._init_db()

    def _init_db(self) -> None:
        path = Path(self.db_path)
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        if path.parent != Path("."):
            os.chmod(path.parent, 0o700)
        with self._connect() as connection:
            connection.executescript(SCHEMA)
        os.chmod(path, 0o600)

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def save_auth_request(self, **values: Any) -> None:
        with self._connect() as connection:
            connection.execute(
                """INSERT OR REPLACE INTO oauth_auth_request
                   (state, authserver_iss, did, handle, pds_url, pkce_verifier,
                    scope, dpop_authserver_nonce, dpop_private_jwk)
                   VALUES (:state, :authserver_iss, :did, :handle, :pds_url,
                           :pkce_verifier, :scope, :dpop_authserver_nonce,
                           :dpop_private_jwk)""",
                values,
            )

    def get_auth_request(self, state: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM oauth_auth_request WHERE state = ?", [state]
            ).fetchone()
        return dict(row) if row else None

    def delete_auth_request(self, state: str) -> None:
        with self._connect() as connection:
            connection.execute("DELETE FROM oauth_auth_request WHERE state = ?", [state])

    def save_session(
        self, session: OAuthSession | None = None, **values: Any
    ) -> OAuthSession:
        owned = session or OAuthSession(**values)
        with self._connect() as connection:
            connection.execute(
                """INSERT OR REPLACE INTO oauth_session
                   (did, handle, pds_url, authserver_iss, access_token, refresh_token,
                    dpop_authserver_nonce, dpop_pds_nonce, dpop_private_jwk, client_id)
                   VALUES (:did, :handle, :pds_url, :authserver_iss, :access_token,
                           :refresh_token, :dpop_authserver_nonce, :dpop_pds_nonce,
                           :dpop_private_jwk, :client_id)""",
                owned.as_dict(),
            )
        return owned

    def get_session(self, did: str) -> OAuthSession | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM oauth_session WHERE did = ?", [did]
            ).fetchone()
        return OAuthSession(**dict(row)) if row else None

    def list_sessions(self) -> list[OAuthSession]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM oauth_session ORDER BY rowid DESC"
            ).fetchall()
        return [OAuthSession(**dict(row)) for row in rows]

    def get_active_session(self) -> OAuthSession | None:
        sessions = self.list_sessions()
        return sessions[0] if sessions else None

    def update_pds_nonce(self, session: OAuthSession, nonce: str) -> None:
        with self._connect() as connection:
            connection.execute(
                "UPDATE oauth_session SET dpop_pds_nonce = ? WHERE did = ?",
                [nonce, session.did],
            )
        session._set_pds_nonce(nonce)

    def update_tokens(
        self,
        session: OAuthSession,
        access_token: str,
        refresh_token: str,
        authserver_nonce: str,
    ) -> None:
        with self._connect() as connection:
            connection.execute(
                """UPDATE oauth_session
                   SET access_token = ?, refresh_token = ?, dpop_authserver_nonce = ?
                   WHERE did = ?""",
                [access_token, refresh_token, authserver_nonce, session.did],
            )
        session._set_tokens(access_token, refresh_token, authserver_nonce)

    def delete_session(self, did: str) -> None:
        with self._connect() as connection:
            connection.execute("DELETE FROM oauth_session WHERE did = ?", [did])
