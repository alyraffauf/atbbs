import { escapeHtml, relativeDate, formatFullDate, getData } from "../lib/util";
import { fetchAndHydrate, type HydratedRecord } from "../lib/atproto";
import { THREAD, REPLY } from "../lib/lexicon";

const PAGE_SIZE = 50;

interface ReplyItem extends HydratedRecord {
  body: string;
  created_at: string;
  attachments: { file: { ref: { $link: string } }; name: string }[];
  quote: string | null;
}

const allReplies: Record<string, ReplyItem> = {};

// --- Quote UI ---

function quoteReply(uri: string, handle: string) {
  const quoteUri = document.getElementById("quote-uri") as HTMLInputElement | null;
  const previewText = document.getElementById("quote-preview-text");
  if (quoteUri) quoteUri.value = uri;
  if (previewText) previewText.textContent = `quoting ${handle}`;
  document.getElementById("quote-preview")?.classList.remove("hidden");
  (document.getElementById("reply-body") as HTMLTextAreaElement | null)?.focus();
}

function clearQuote() {
  (document.getElementById("quote-uri") as HTMLInputElement | null)!.value = "";
  document.getElementById("quote-preview")?.classList.add("hidden");
}

// --- Render helpers ---

function renderActions(
  r: ReplyItem,
  userDid: string,
  sysopDid: string,
  handle: string,
  threadDid: string,
  threadTid: string,
): string {
  const actions: string[] = [];

  if (userDid) {
    actions.push(
      `<button type="button" class="quote-btn text-xs text-neutral-500 hover:text-neutral-300" data-uri="${r.uri}" data-handle="${escapeHtml(r.handle)}">quote</button>`,
    );
  }
  if (userDid && userDid === r.did) {
    actions.push(
      `<form method="post" action="/bbs/${handle}/thread/${threadDid}/${threadTid}/reply/${r.rkey}/delete" class="inline" onsubmit="return confirm('Delete this reply?')"><button type="submit" class="text-xs text-neutral-500 hover:text-red-400">delete</button></form>`,
    );
  }
  if (userDid && userDid === sysopDid && userDid !== r.did) {
    actions.push(
      `<form method="post" action="/bbs/${handle}/ban/${r.did}" class="inline" onsubmit="return confirm('Ban this user from your BBS?')"><button type="submit" class="text-xs text-neutral-500 hover:text-red-400">ban</button></form>`,
    );
  }
  if (userDid && userDid === sysopDid) {
    actions.push(
      `<form method="post" action="/bbs/${handle}/hide" class="inline" onsubmit="return confirm('Hide this post?')"><input type="hidden" name="uri" value="${r.uri}"><button type="submit" class="text-xs text-neutral-500 hover:text-red-400">hide</button></form>`,
    );
  }

  if (!actions.length) return "";
  return `<span class="reply-actions flex items-center gap-3">${actions.join(" ")}</span>`;
}

function renderQuoteBlock(r: ReplyItem): string {
  if (!r.quote || !allReplies[r.quote]) return "";
  const q = allReplies[r.quote];
  const preview = q.body.substring(0, 200) + (q.body.length > 200 ? "..." : "");
  return `<div class="border-l-2 border-neutral-700 pl-3 mb-3 py-1 text-sm text-neutral-500"><span class="text-neutral-400">${escapeHtml(q.handle)}:</span> ${escapeHtml(preview)}</div>`;
}

function renderAttachments(r: ReplyItem): string {
  return (r.attachments || [])
    .map(
      (a) =>
        `<a href="${r.pds}/xrpc/com.atproto.sync.getBlob?did=${r.did}&cid=${a.file.ref["$link"]}" target="_blank" class="text-xs text-neutral-500 hover:text-neutral-300 block mt-1">[${escapeHtml(a.name)}]</a>`,
    )
    .join("");
}

function renderReply(
  r: ReplyItem,
  handle: string,
  threadDid: string,
  threadTid: string,
  userDid: string,
  sysopDid: string,
): string {
  return `<div class="reply-card border border-neutral-800/50 rounded p-4">
    <div class="flex items-baseline justify-between mb-2">
      <div class="flex items-baseline gap-2">
        <span class="text-neutral-300">${escapeHtml(r.handle)}</span>
        <span class="text-neutral-600">&middot;</span>
        <span class="text-xs text-neutral-500" title="${formatFullDate(r.created_at)}">${relativeDate(r.created_at)}</span>
      </div>
      ${renderActions(r, userDid, sysopDid, handle, threadDid, threadTid)}
    </div>
    ${renderQuoteBlock(r)}
    <p class="text-neutral-400 whitespace-pre-wrap leading-relaxed">${escapeHtml(r.body)}</p>
    ${renderAttachments(r)}
  </div>`;
}

// --- Data loading ---

function toReplyItem(r: HydratedRecord): ReplyItem {
  return {
    ...r,
    body: (r.value.body as string) ?? "",
    created_at: (r.value.createdAt as string) ?? "",
    attachments: (r.value.attachments as ReplyItem["attachments"]) ?? [],
    quote: (r.value.quote as string) ?? null,
  };
}

function createReplyLoader(
  threadDid: string,
  threadTid: string,
  handle: string,
  userDid: string,
  sysopDid: string,
  bannedDids: Set<string>,
  hiddenPosts: Set<string>,
) {
  const container = document.getElementById("replies")!;
  const nextContainer = document.getElementById("replies-next");
  const threadUri = `at://${threadDid}/${THREAD}/${threadTid}`;
  let nextCursor: string | null = null;

  async function load(cursor?: string) {
    const loading = document.getElementById("replies-loading");

    try {
      const result = await fetchAndHydrate(
        threadUri,
        `${REPLY}:subject`,
        { limit: PAGE_SIZE, cursor, bannedDids, hiddenPosts },
      );

      if (loading) loading.remove();

      const replies = result.records
        .map(toReplyItem)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));

      for (const r of replies) {
        allReplies[r.uri] = r;
      }

      for (const r of replies) {
        container.insertAdjacentHTML(
          "beforeend",
          renderReply(r, handle, threadDid, threadTid, userDid, sysopDid),
        );
      }

      nextCursor = result.cursor;
      nextContainer?.classList.toggle("hidden", !nextCursor);

      if (container.children.length === 0 && !userDid) {
        container.innerHTML = '<p class="text-neutral-500">No replies yet.</p>';
      }
    } catch {
      if (loading) loading.textContent = "Could not fetch replies.";
    }
  }

  // Bind load-more
  document.getElementById("load-more")?.addEventListener("click", () => {
    if (nextCursor) load(nextCursor);
  });

  // Initial load
  load();
}

// --- Init ---

export function initThread() {
  const threadDid = getData("replies", "threadDid");
  const threadTid = getData("replies", "threadTid");
  const handle = getData("replies", "handle");
  const userDid = getData("replies", "userDid");
  const sysopDid = getData("replies", "sysopDid");
  const bannedDids = new Set(
    (getData("replies", "bannedDids") || "").split(",").filter(Boolean),
  );
  const hiddenPosts = new Set(
    (getData("replies", "hiddenPosts") || "").split(",").filter(Boolean),
  );

  document.getElementById("quote-clear")?.addEventListener("click", clearQuote);
  document.getElementById("replies")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(".quote-btn") as HTMLElement | null;
    if (btn) quoteReply(btn.dataset.uri!, btn.dataset.handle!);
  });

  createReplyLoader(threadDid, threadTid, handle, userDid, sysopDid, bannedDids, hiddenPosts);
}
