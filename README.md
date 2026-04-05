<div align="center">
  <p>
    <a href="https://github.com/alyraffauf/atbbs/actions/workflows/docker.yml"><img src="https://github.com/alyraffauf/atbbs/actions/workflows/docker.yml/badge.svg?branch=master" alt="Build"></a>
    <a href="https://www.gnu.org/licenses/agpl-3.0"><img src="https://img.shields.io/badge/License-AGPL%20v3-blue.svg" alt="License: AGPL v3"></a>
    <a href="https://ko-fi.com/alyraffauf"><img src="https://img.shields.io/badge/Donate-Ko--fi-ff5e5b?logo=ko-fi&logoColor=white" alt="Ko-fi"></a>
  </p>
  <img width="128" height="128" src="assets/logo.svg" alt="@bbs logo">
  <h1>@bbs</h1>
  <p>Bulletin boards on <a href="https://atproto.com">atproto</a>. Web app and terminal client.</p>
</div>

## Features

- **Web and terminal**: Use it in your browser or dial in from a TUI.
- **Serverless**: Run a BBS straight from your atproto account. No hosting required.
- **Replies and quotes**: Flat threads with inline quoting.
- **Attachments**: Upload files to threads and replies.
- **Messages**: Know when someone replies to your thread or quotes you.
- **Moderation**: Ban users, hide posts, manage your boards.
- **Discovery**: Browse BBSes from across the network.

## Quick start

### TUI (recommended)

Requires Python 3.14+ and [uv](https://docs.astral.sh/uv/).

```bash
uv tool install atbbs
atbbs                  # launch TUI
atbbs dial aly.codes   # dial a BBS directly
atbbs serve            # start the web server
atbbs --help           # see all options
```

Or from source:

```bash
git clone https://github.com/alyraffauf/atbbs.git
cd atbbs
uv sync
uv run atbbs
```

### Web app (Docker)

```bash
docker run -d -p 8000:8000 -v atbbs-data:/data -e PUBLIC_URL=https://your-domain.com ghcr.io/alyraffauf/atbbs:latest
```

Or with Docker Compose:

```bash
git clone https://github.com/alyraffauf/atbbs.git
cd atbbs
docker compose up -d
```

Visit `http://localhost:8000`.

### Web app (from source)

```bash
git clone https://github.com/alyraffauf/atbbs.git
cd atbbs
uv sync
just dev
```

## Architecture

atbbs has no backend database for content. All BBS data lives in atproto repos:

- **Sysop records**: `xyz.atboards.site`, `xyz.atboards.board`, `xyz.atboards.news`
- **User records**: `xyz.atboards.thread`, `xyz.atboards.reply`

The web app and TUI query existing network infrastructure:

- [Slingshot](https://slingshot.microcosm.blue/) — cached record and identity fetching
- [Constellation](https://constellation.microcosm.blue/) — backlink index for discovering threads and replies
- [UFOs](https://ufos.microcosm.blue/) — BBS discovery feed

## Configuration

On first run, atbbs generates:

- `secrets.json` — app secret key and OAuth client signing key
- `atbbs.db` — SQLite database for OAuth sessions

**Web app (Docker)**: Set `ATBBS_DATA_DIR` to control where these are stored (default: `/data`). Set `PUBLIC_URL` to your domain for OAuth callbacks.

**Web app (CLI)**: Use `atbbs serve --data-dir` and `--public-url` to configure. Defaults to the platform data directory and `http://{host}:{port}`.

**TUI**: Data is stored in `~/.local/share/atbbs/` (Linux), `~/Library/Application Support/atbbs/` (macOS), or `%APPDATA%/atbbs/` (Windows).

## License

[AGPL-3.0](LICENSE.md)
