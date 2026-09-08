default: dev

dev:
    cd web && npm run dev

tui:
    uv run python -m tui

test *args:
    uv run pytest {{ args }}

fmt:
    uv format
    npm run format

lex:
    cd web && npm run lex
    uv run python scripts/generate_limits.py

build:
    cd web && VITE_PUBLIC_URL=${PUBLIC_URL:-} npm run build

docker:
    docker build -t atbbs .

up:
    docker compose up -d

down:
    docker compose down

logs:
    docker compose logs -f

# Set the Python and npm workspace versions.
version ver:
    uv run python -c "import re, pathlib; p=pathlib.Path('pyproject.toml'); p.write_text(re.sub(r'^version = \".*\"', 'version = \"{{ ver }}\"', p.read_text(), count=1, flags=re.M))"
    npm version {{ ver }} --workspaces --no-git-tag-version --allow-same-version
    uv lock

# Tag and push a release
release ver:
    test -z "$(git status --porcelain)" || { echo "release requires a clean tree" >&2; exit 1; }
    just version {{ ver }}
    git add pyproject.toml uv.lock package-lock.json atbbs/package.json atproto/package.json opengraph/package.json web/package.json
    git commit -m "v{{ ver }}"
    git tag "v{{ ver }}"
    git push
    git push --tags
