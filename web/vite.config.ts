import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import shared from "../atbbs/shared.json" with { type: "json" };

const SERVER_HOST = "127.0.0.1";
const SERVER_PORT = 5173;
const OAUTH_SCOPE = [
  ...shared.oauth_base_scopes,
  ...Object.values(shared.lexicon_collections).map((nsid) => `repo:${nsid}`),
].join(" ");

// Placeholder the Docker entrypoint replaces at runtime with PUBLIC_URL.
const PUBLIC_URL_TOKEN = "__PUBLIC_URL__";

function buildMetadata(
  publicUrl: string,
  clientId = `${publicUrl}/client-metadata.json`,
) {
  return {
    client_id: clientId,
    client_name: "atbbs",
    client_uri: publicUrl,
    redirect_uris: [`${publicUrl}/oauth/callback`],
    scope: OAUTH_SCOPE,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    application_type: "web",
    dpop_bound_access_tokens: true,
  };
}

/**
 * Dev: synthesizes a loopback client_id (atproto OAuth forbids `localhost`,
 * so the redirect goes to 127.0.0.1).
 *
 * Build with VITE_PUBLIC_URL: emits client-metadata.json for static deploys.
 *
 * Build without VITE_PUBLIC_URL: emits *.template.json files with a
 * __PUBLIC_URL__ token. The Docker entrypoint substitutes at runtime from
 * the PUBLIC_URL env var. NSIDs/scope live in atbbs/shared.json only.
 */
export default defineConfig(({ command }) => {
  const isBuild = command === "build";
  const publicUrl = process.env.VITE_PUBLIC_URL?.trim();
  const devOrigin = `http://${SERVER_HOST}:${SERVER_PORT}`;
  const devRedirectUri = `${devOrigin}/oauth/callback`;
  const devClientId =
    `http://localhost?redirect_uri=${encodeURIComponent(devRedirectUri)}` +
    `&scope=${encodeURIComponent(OAUTH_SCOPE)}`;

  let staticFile: { fileName: string; source: string } | undefined;
  if (isBuild) {
    if (publicUrl) {
      let parsedPublicUrl: URL;
      try {
        parsedPublicUrl = new URL(publicUrl);
      } catch {
        throw new Error(`VITE_PUBLIC_URL must be a bare HTTPS origin.`);
      }
      if (
        parsedPublicUrl.protocol !== "https:" ||
        parsedPublicUrl.origin !== publicUrl ||
        parsedPublicUrl.username ||
        parsedPublicUrl.password
      ) {
        throw new Error(
          `VITE_PUBLIC_URL must be a bare HTTPS origin (got ${publicUrl}).`,
        );
      }
      staticFile = {
        fileName: "client-metadata.json",
        source: JSON.stringify(buildMetadata(publicUrl), null, 2) + "\n",
      };
    } else {
      staticFile = {
        fileName: "client-metadata.template.json",
        source: JSON.stringify(buildMetadata(PUBLIC_URL_TOKEN), null, 2) + "\n",
      };
    }
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "atbbs-emit-static-config",
        configureServer(server) {
          server.middlewares.use((request, response, next) => {
            if (request.url?.split("?", 1)[0] !== "/client-metadata.json") {
              next();
              return;
            }
            response.setHeader("Content-Type", "application/json");
            response.setHeader("Access-Control-Allow-Origin", "*");
            response.end(
              JSON.stringify(buildMetadata(devOrigin, devClientId), null, 2) +
                "\n",
            );
          });
        },
        generateBundle() {
          if (staticFile) this.emitFile({ type: "asset", ...staticFile });
        },
      },
    ],
    server: {
      host: SERVER_HOST,
      port: SERVER_PORT,
      // Allow importing ../atbbs/shared.json (shared with the Python TUI).
      fs: { allow: [".."] },
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: "vendor",
                test: /node_modules/,
              },
            ],
          },
        },
      },
    },
  };
});
