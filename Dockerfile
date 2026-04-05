FROM python:3.14-slim AS build

WORKDIR /app

# Install build tools
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
ADD https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-linux-x64 /usr/local/bin/tailwindcss
RUN chmod +x /usr/local/bin/tailwindcss
RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm && rm -rf /var/lib/apt/lists/*

# Install JS dependencies and build frontend
COPY package.json ./
RUN npm install
COPY web/static/input.css web/static/input.css
COPY web/templates/ web/templates/
COPY web/ts/ web/ts/
RUN tailwindcss -i web/static/input.css -o web/static/style.css --minify
RUN npx esbuild web/ts/main.ts --bundle --outfile=web/static/app.js --minify

# Install Python dependencies
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev


FROM python:3.14-slim

WORKDIR /app

# Copy uv and dependencies
COPY --from=build /usr/local/bin/uv /usr/local/bin/uv
COPY --from=build /app/.venv /app/.venv

# Copy application code
COPY main.py ./
COPY core/ core/
COPY web/ web/
COPY lexicons/ lexicons/

# Copy built frontend assets
COPY --from=build /app/web/static/style.css web/static/style.css
COPY --from=build /app/web/static/app.js web/static/app.js

# Remove TS source from final image
RUN rm -rf web/ts

RUN mkdir -p /data

ENV ATBBS_DATA_DIR=/data
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/')" || exit 1

CMD ["uv", "run", "hypercorn", "main:app", "--bind", "0.0.0.0:8000", "--workers", "3"]
