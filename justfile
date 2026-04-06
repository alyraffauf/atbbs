default: dev

dev:
    #!/bin/sh
    trap 'kill 0' EXIT
    npx @tailwindcss/cli -i web/static/input.css -o web/static/style.css --watch &
    npx esbuild web/ts/main.ts --bundle --outfile=web/static/app.js --watch=forever &
    PUBLIC_URL=http://localhost:5151 QUART_DEBUG=1 uv run quart --app "web.app:create_app()" run --port 5151 --reload &
    wait

css:
    npx @tailwindcss/cli -i web/static/input.css -o web/static/style.css --minify

js:
    npx esbuild web/ts/main.ts --bundle --outfile=web/static/app.js --minify

fmt:
    uv format
    npx prettier --write web/ts/

tui:
    uv run python -m tui

build:
    docker build -t atbbs .

up:
    docker compose up -d

down:
    docker compose down

logs:
    docker compose logs -f

# Set version in pyproject.toml
version ver:
    uv run python -c "import re, pathlib; p=pathlib.Path('pyproject.toml'); p.write_text(re.sub(r'^version = \".*\"', 'version = \"{{ ver }}\"', p.read_text(), count=1, flags=re.M))"
    uv lock

# Tag and push a release
release ver: (version ver) css js
    git add -A
    git commit -m "v{{ ver }}"
    git tag "v{{ ver }}"
    git push
    git push --tags
