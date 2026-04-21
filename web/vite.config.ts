import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import shared from "../data/shared.json";

const SERVER_HOST = "127.0.0.1";
const SERVER_PORT = 5173;

const SCOPE = [
  ...shared.oauth_base_scopes,
  ...Object.values(shared.lexicon_collections).map((nsid) => `repo:${nsid}`),
].join(" ");

// Placeholder the Docker entrypoint replaces at runtime with PUBLIC_URL.
const PUBLIC_URL_TOKEN = "__PUBLIC_URL__";

interface ClientMetadata {
  client_id: string;
  client_name: string;
  client_uri: string;
  redirect_uris: [string];
  scope: string;
  grant_types: ["authorization_code", "refresh_token"];
  response_types: ["code"];
  token_endpoint_auth_method: "none";
  application_type: "web";
  dpop_bound_access_tokens: true;
}

function buildMetadata(publicUrl: string): ClientMetadata {
  const u = publicUrl.replace(/\/$/, "");
  return {
    client_id: `${u}/client-metadata.json`,
    client_name: "atbbs",
    client_uri: u,
    redirect_uris: [`${u}/oauth/callback`],
    scope: SCOPE,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    application_type: "web",
    dpop_bound_access_tokens: true,
  };
}

function buildConfig(publicUrl: string) {
  const u = publicUrl.replace(/\/$/, "");
  return {
    client_id: `${u}/client-metadata.json`,
    redirect_uri: `${u}/oauth/callback`,
    scope: SCOPE,
  };
}

/**
 * Dev: synthesizes a loopback client_id (atproto OAuth forbids `localhost`,
 * so the redirect goes to 127.0.0.1).
 *
 * Build with VITE_PUBLIC_URL: emits config.json + client-metadata.json for
 * static deploys (Cloudflare Pages, etc.).
 *
 * Build without VITE_PUBLIC_URL: emits *.template.json files with a
 * __PUBLIC_URL__ token. The Docker entrypoint substitutes at runtime from
 * the PUBLIC_URL env var. NSIDs/scope live in data/shared.json only.
 */
export default defineConfig(({ command }) => {
  const isBuild = command === "build";
  const publicUrl = process.env.VITE_PUBLIC_URL?.trim();

  if (!isBuild) {
    // Dev: set env vars for the loopback OAuth flow.
    const redirectUri = `http://${SERVER_HOST}:${SERVER_PORT}/oauth/callback`;
    process.env.VITE_OAUTH_CLIENT_ID =
      `http://localhost?redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(SCOPE)}`;
    process.env.VITE_OAUTH_REDIRECT_URI = redirectUri;
    process.env.VITE_OAUTH_SCOPE = SCOPE;
  }

  const staticFiles: Array<{ fileName: string; source: string }> = [];
  if (isBuild) {
    if (publicUrl) {
      if (!publicUrl.startsWith("https://")) {
        throw new Error(
          `VITE_PUBLIC_URL must use https:// (got ${publicUrl}).`,
        );
      }
      staticFiles.push(
        {
          fileName: "client-metadata.json",
          source: JSON.stringify(buildMetadata(publicUrl), null, 2) + "\n",
        },
        {
          fileName: "config.json",
          source: JSON.stringify(buildConfig(publicUrl), null, 2) + "\n",
        },
      );
    } else {
      staticFiles.push(
        {
          fileName: "client-metadata.template.json",
          source:
            JSON.stringify(buildMetadata(PUBLIC_URL_TOKEN), null, 2) + "\n",
        },
        {
          fileName: "config.template.json",
          source: JSON.stringify(buildConfig(PUBLIC_URL_TOKEN), null, 2) + "\n",
        },
      );
    }
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "atbbs-emit-static-config",
        generateBundle() {
          for (const f of staticFiles) {
            this.emitFile({ type: "asset", ...f });
          }
        },
      },
    ],
    server: {
      host: SERVER_HOST,
      port: SERVER_PORT,
      // Allow importing ../../data/shared.json (shared with the Python TUI).
      fs: { allow: [".."] },
    },
  };
});
