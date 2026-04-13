# atbbs web

Static React SPA. No backend — reads go to Slingshot/Constellation, writes go to the user's PDS via atproto OAuth.

## Development

```sh
cd web
npm install
npm run dev
```

OAuth works automatically on `http://127.0.0.1:5173` via atproto's loopback client flow.

## Production

### Static deploy (Cloudflare Pages, etc.)

```sh
VITE_PUBLIC_URL=https://your-domain.com npm run build
```

Deploy `dist/`. The `_redirects` file handles SPA routing on Cloudflare Pages.

### Docker

```sh
docker run -d -p 8080:80 -e PUBLIC_URL=https://your-domain.com ghcr.io/alyraffauf/atbbs:latest
```

The entrypoint generates `config.json` and `client-metadata.json` at runtime from `PUBLIC_URL`.

### OAuth

`https://your-domain.com/client-metadata.json` must be publicly fetchable — atproto auth servers fetch it during the OAuth handshake.
