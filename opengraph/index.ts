import { ImageResponse, loadGoogleFont } from "workers-og";
import {
  getRecord,
  resolveIdentity,
  type ATRecord,
  type ResolvedIdentity,
} from "@atbbs/atproto";
import { BOARD, POST, SITE } from "@atbbs/core/config";
import { isBoardRecord, isPostRecord, isSiteRecord } from "@atbbs/core/schema";
import heroLogoSvg from "./hero-light.svg";

const DEFAULT_TITLE = "atbbs";
const DEFAULT_DESCRIPTION = "Decentralized forums on the AT Protocol.";

// Tailwind neutral palette — matches the site's light theme.
const COLORS = {
  background: "#fafafa", // neutral-50
  title: "#171717", // neutral-900
  subtitle: "#525252", // neutral-600
  description: "#525252", // neutral-600
};

// Types

interface RouteBase {
  handle: string;
}

interface BbsRoute extends RouteBase {
  type: "bbs";
}

interface BoardRoute extends RouteBase {
  type: "board";
  slug: string;
}

interface ThreadRoute extends RouteBase {
  type: "thread";
  did: string;
  rkey: string;
}

interface NewsRoute extends RouteBase {
  type: "news";
  rkey: string;
}

type Route = BbsRoute | BoardRoute | ThreadRoute | NewsRoute;

interface Metadata {
  title: string;
  subtitle: string;
  description: string;
  atTags: AtTags;
}

interface AtTags {
  canonical: string;
  author: string;
  alternate?: string;
  me: string;
}

// Utils

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

async function resolveIdentityOrNull(
  handle: string,
): Promise<ResolvedIdentity | null> {
  try {
    return await resolveIdentity(handle);
  } catch {
    return null;
  }
}

async function fetchRecord(
  did: string,
  collection: string,
  recordKey: string,
): Promise<ATRecord | null> {
  try {
    return await getRecord(did, collection, recordKey);
  } catch {
    return null;
  }
}

async function fetchSiteName(did: string, fallback: string): Promise<string> {
  const siteRecord = await fetchRecord(did, SITE, "self");
  return siteRecord && isSiteRecord(siteRecord)
    ? siteRecord.value.name
    : fallback;
}

// --- Route parsing ---

export function parseRoute(path: string): Route | null {
  // Strip /og prefix and .png suffix so this works for both HTML and image routes.
  const normalizedPath = path.replace(/^\/og/, "").replace(/\.png$/, "");

  const bbsMatch = normalizedPath.match(/^\/bbs\/([^/]+)$/);
  if (bbsMatch) return { type: "bbs", handle: bbsMatch[1] };

  const boardMatch = normalizedPath.match(/^\/bbs\/([^/]+)\/board\/([^/]+)$/);
  if (boardMatch)
    return { type: "board", handle: boardMatch[1], slug: boardMatch[2] };

  const threadMatch = normalizedPath.match(
    /^\/bbs\/([^/]+)\/thread\/([^/]+)\/([^/]+)$/,
  );
  if (threadMatch)
    return {
      type: "thread",
      handle: threadMatch[1],
      did: threadMatch[2],
      rkey: threadMatch[3],
    };

  const newsMatch = normalizedPath.match(/^\/bbs\/([^/]+)\/news\/([^/]+)$/);
  if (newsMatch)
    return { type: "news", handle: newsMatch[1], rkey: newsMatch[2] };

  return null;
}

// Metadata

export async function fetchMetadata(route: Route): Promise<Metadata | null> {
  const identity = await resolveIdentityOrNull(route.handle);
  if (!identity) return null;

  if (route.type === "bbs") {
    const siteRecord = await fetchRecord(identity.did, SITE, "self");
    if (siteRecord && isSiteRecord(siteRecord)) {
      return {
        title: siteRecord.value.name,
        subtitle: "",
        description: siteRecord.value.description || "",
        atTags: {
          canonical: siteRecord.uri,
          author: identity.did,
          me: identity.did,
        },
      };
    }
  } else if (route.type === "board") {
    const siteName = await fetchSiteName(identity.did, route.handle);
    const boardRecord = await fetchRecord(identity.did, BOARD, route.slug);
    if (boardRecord && isBoardRecord(boardRecord)) {
      return {
        title: boardRecord.value.name,
        subtitle: siteName,
        description: boardRecord.value.description || "",
        atTags: {
          canonical: boardRecord.uri,
          author: identity.did,
          me: identity.did,
        },
      };
    }
  } else if (route.type === "thread") {
    const siteName = await fetchSiteName(identity.did, route.handle);
    const postRecord = await fetchRecord(route.did, POST, route.rkey);
    if (postRecord && isPostRecord(postRecord) && !postRecord.value.root) {
      const scope = postRecord.value.scope;
      if (!scope.startsWith(`at://${identity.did}/${BOARD}/`)) return null;
      const boardKey = scope.split("/").at(-1);
      if (!boardKey) return null;
      const board = await fetchRecord(identity.did, BOARD, boardKey);
      if (!board || !isBoardRecord(board)) return null;
      return {
        title: postRecord.value.title || "Thread",
        subtitle: siteName,
        description: postRecord.value.body || "",
        atTags: {
          canonical: postRecord.uri,
          author: route.did,
          alternate: postRecord.value.root,
          me: identity.did,
        },
      };
    }
  } else if (route.type === "news") {
    const siteName = await fetchSiteName(identity.did, route.handle);
    const postRecord = await fetchRecord(identity.did, POST, route.rkey);
    if (
      postRecord &&
      isPostRecord(postRecord) &&
      !postRecord.value.root &&
      postRecord.value.scope === `at://${identity.did}/${SITE}/self`
    ) {
      return {
        title: postRecord.value.title || "News",
        subtitle: siteName,
        description: postRecord.value.body || "",
        atTags: {
          canonical: postRecord.uri,
          author: identity.did,
          me: identity.did,
        },
      };
    }
  }

  return null;
}

// Generate OG Images

const HERO_LOGO_DATA_URI =
  "data:image/svg+xml," + encodeURIComponent(heroLogoSvg);

let geistMonoFontPromise: Promise<ArrayBuffer> | undefined;

function loadGeistMonoFont() {
  if (!geistMonoFontPromise) {
    geistMonoFontPromise = loadGoogleFont({
      family: "Geist Mono",
      weight: 400,
    }).catch((error) => {
      geistMonoFontPromise = undefined;
      throw error;
    });
  }
  return geistMonoFontPromise;
}

async function renderOgImage(
  title: string,
  subtitle: string,
  description: string,
): Promise<Response> {
  const displayTitle = escapeHtml(truncate(title, 40));
  const displaySubtitle = escapeHtml(subtitle);
  const displayDescription = escapeHtml(truncate(description, 120));

  const fontData = await loadGeistMonoFont();

  const subtitleHtml = displaySubtitle
    ? `<div style="display: flex; font-size: 24px; color: ${COLORS.subtitle}; font-family: 'Geist Mono';">${displaySubtitle}</div>`
    : "";

  const html = `
    <div style="display: flex; flex-direction: column; justify-content: space-between; width: 1200px; height: 630px; background-color: ${COLORS.background}; padding: 80px 90px;">
      <img src="${HERO_LOGO_DATA_URI}" width="276" height="84" style="image-rendering: pixelated;" />
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${subtitleHtml}
        <div style="display: flex; font-size: 56px; color: ${COLORS.title}; font-family: 'Geist Mono'; line-height: 1.2;">${displayTitle}</div>
        <div style="display: flex; font-size: 22px; color: ${COLORS.description}; font-family: 'Geist Mono'; line-height: 1.4;">${displayDescription}</div>
      </div>
    </div>
  `;

  return new ImageResponse(html, {
    width: 1200,
    height: 630,
    fonts: [
      {
        name: "Geist Mono",
        data: fontData,
        style: "normal",
        weight: 400,
      },
    ],
  });
}

// Inject HTML

export function injectMetadata(
  html: string,
  title: string,
  description: string,
  pageUrl: string,
  imageUrl: string,
  atTags: AtTags,
): string {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description.substring(0, 200));
  const safePageUrl = escapeHtml(pageUrl);
  const safeImageUrl = escapeHtml(imageUrl);

  const metadata = [
    "<!-- atbbs:metadata:start -->",
    `    <title>${safeTitle}</title>`,
    `    <meta name="description" content="${safeDescription}" />`,
    `    <meta property="og:title" content="${safeTitle}" />`,
    `    <meta property="og:description" content="${safeDescription}" />`,
    `    <meta property="og:image" content="${safeImageUrl}" />`,
    `    <meta property="og:url" content="${safePageUrl}" />`,
    '    <meta property="og:type" content="website" />',
    renderAtTags(atTags),
    "    <!-- atbbs:metadata:end -->",
  ]
    .filter(Boolean)
    .join("\n");
  return html.replace(
    /<!-- atbbs:metadata:start -->[\s\S]*?<!-- atbbs:metadata:end -->/,
    metadata,
  );
}

function renderAtTags(atTags: AtTags): string {
  const tags: Array<[string, string | undefined]> = [
    ["at:canonical", atTags.canonical],
    ["at:author", atTags.author],
    ["at:alternate", atTags.alternate],
    ["at:me", atTags.me],
  ];

  return tags
    .filter((tag): tag is [string, string] => tag[1] !== undefined)
    .map(
      ([name, value]) =>
        `    <meta name="${name}" content="${escapeHtml(value)}" />`,
    )
    .join("\n");
}

// Entry point

export default {
  async fetch(
    request: Request,
    _environment: unknown,
    context: ExecutionContext,
  ): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }
    const url = new URL(request.url);
    const path = url.pathname;

    // Dynamic og:image at /og/bbs/... — cached at the edge for 1 hour.
    if (path.startsWith("/og/bbs/")) {
      const cache = caches.default;
      const cacheKey = new Request(`${url.origin}${url.pathname}`, {
        method: "GET",
      });
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        return request.method === "HEAD"
          ? new Response(null, cachedResponse)
          : cachedResponse;
      }

      const route = parseRoute(path);
      let imageResponse: Response;

      try {
        const metadata = route ? await fetchMetadata(route) : null;
        imageResponse = metadata
          ? await renderOgImage(
              metadata.title,
              metadata.subtitle,
              metadata.description,
            )
          : await renderOgImage(DEFAULT_TITLE, "", DEFAULT_DESCRIPTION);
      } catch {
        imageResponse = await renderOgImage(
          DEFAULT_TITLE,
          "",
          DEFAULT_DESCRIPTION,
        );
      }

      const cachedCopy = new Response(imageResponse.body, imageResponse);
      cachedCopy.headers.set("Cache-Control", "public, max-age=3600");
      context.waitUntil(cache.put(cacheKey, cachedCopy.clone()));
      return request.method === "HEAD"
        ? new Response(null, cachedCopy)
        : cachedCopy;
    }

    // Inject metadata into HTML for /bbs/... routes.
    const route = parseRoute(path);
    const originResponse = await fetch(request);
    const contentType = originResponse.headers.get("content-type") || "";

    if (!route || !contentType.includes("text/html")) {
      return originResponse;
    }

    let html = await originResponse.text();

    try {
      const metadata = await fetchMetadata(route);
      if (metadata) {
        const fullTitle = metadata.subtitle
          ? `${metadata.title} \u2014 ${metadata.subtitle}`
          : metadata.title;
        const imageUrl = `${url.origin}/og${path}.png`;
        html = injectMetadata(
          html,
          fullTitle,
          metadata.description,
          url.toString(),
          imageUrl,
          metadata.atTags,
        );
      }
    } catch {
      // On any error, serve the original HTML unmodified.
    }

    const headers = new Headers(originResponse.headers);
    for (const name of [
      "content-length",
      "content-encoding",
      "etag",
      "last-modified",
    ]) {
      headers.delete(name);
    }
    return new Response(request.method === "HEAD" ? null : html, {
      status: originResponse.status,
      headers,
    });
  },
};
