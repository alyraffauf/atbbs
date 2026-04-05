FROM python:3.14-slim AS build

WORKDIR /app

# Install build tools
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
ADD https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-linux-x64 /usr/local/bin/tailwindcss
RUN chmod +x /usr/local/bin/tailwindcss
RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm && rm -rf /var/lib/apt/lists/*

# Install JS dependencies
COPY package.json ./
RUN npm install

# Copy all source
COPY pyproject.toml uv.lock README.md ./
COPY cli/ cli/
COPY core/ core/
COPY tui/ tui/
COPY web/ web/

# Build frontend assets (before uv sync so they're included in the package)
RUN tailwindcss -i web/static/input.css -o web/static/style.css --minify
RUN npx esbuild web/ts/main.ts --bundle --outfile=web/static/app.js --minify

# Remove TS source before installing (excluded in wheel anyway)
RUN rm -rf web/ts

# Install Python package
RUN uv sync --frozen --no-dev


FROM python:3.14-slim

WORKDIR /app

COPY --from=build /usr/local/bin/uv /usr/local/bin/uv
COPY --from=build /app/.venv /app/.venv

RUN mkdir -p /data

ENV ATBBS_DATA_DIR=/data
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/')" || exit 1

CMD ["uv", "run", "atbbs", "serve", "--host", "0.0.0.0", "--port", "8000", "--workers", "3", "--data-dir", "/data"]
