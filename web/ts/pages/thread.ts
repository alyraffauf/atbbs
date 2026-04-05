import { escapeHtml, relativeDate, formatFullDate, getData } from "../lib/util";
import {
  getBacklinks,
  getRecordsBatch,
  resolveIdentitiesBatch,
  parseAtUri,
} from "../lib/atproto";
import { THREAD, REPLY } from "../lib/lexicon";

interface Attachment {
  file: { ref: { $link: string } };
  name: string;
}

interface ReplyItem {
  uri: string;
  did: string;
  rkey: string;
  handle: string;
  pds_url: string;
  body: string;
  created_at: string;
  attachments: Attachment[];
  quote: string | null;
}

const allReplies: Record<string, ReplyItem> = {};

function quoteReply(uri: string, handle: string) {
  const quoteUri = document.getElementById("quote-uri") as HTMLInputElement | null;
  const preview = document.getElementById("quote-preview");
  const previewText = document.getElementById("quote-preview-text");
  const replyBody = document.getElementById("reply-body") as HTMLTextAreaElement | null;

  if (quoteUri) quoteUri.value = uri;
  if (previewText) previewText.textContent = `quoting ${handle}`;
  preview?.classList.remove("hidden");
  replyBody?.focus();
}

function clearQuote() {
  const quoteUri = document.getElementById("quote-uri") as HTMLInputElement | null;
  const preview = document.getElementById("quote-preview");

  if (quoteUri) quoteUri.value = "";
  preview?.classList.add("hidden");
}

function renderReply(
  r: ReplyItem,
  handle: string,
  threadDid: string,
  threadTid: string,
  userDid: string,
  sysopDid: string,
): string {
  let deleteBtn = "";
  if (userDid && userDid === r.did) {
    deleteBtn = `<form method="post" action="/bbs/${handle}/thread/${threadDid}/${threadTid}/reply/${r.rkey}/delete" class="inline" onsubmit="return confirm('Delete this reply?')"><button type="submit" class="text-xs text-neutral-500 hover:text-red-400">delete</button></form>`;
  }

  let banBtn = "";
  if (userDid && userDid === sysopDid && userDid !== r.did) {
    banBtn = `<form method="post" action="/bbs/${handle}/ban/${r.did}" class="inline" onsubmit="return confirm('Ban this user from your BBS?')"><button type="submit" class="text-xs text-neutral-500 hover:text-red-400">ban</button></form>`;
  }

  let hideBtn = "";
  if (userDid && userDid === sysopDid) {
    hideBtn = `<form method="post" action="/bbs/${handle}/hide" class="inline" onsubmit="return confirm('Hide this post?')"><input type="hidden" name="uri" value="${r.uri}"><button type="submit" class="text-xs text-neutral-500 hover:text-red-400">hide</button></form>`;
  }

  let quoteBlock = "";
  if (r.quote && allReplies[r.quote]) {
    const q = allReplies[r.quote];
    quoteBlock = `<div class="border-l-2 border-neutral-700 pl-3 mb-3 py-1 text-sm text-neutral-500"><span class="text-neutral-400">${escapeHtml(q.handle)}:</span> ${escapeHtml(q.body.substring(0, 200))}${q.body.length > 200 ? "..." : ""}</div>`;
  }

  const quoteBtn = userDid
    ? `<button type="button" class="quote-btn text-xs text-neutral-500 hover:text-neutral-300" data-uri="${r.uri}" data-handle="${escapeHtml(r.handle)}">quote</button>`
    : "";

  const actions = [quoteBtn, deleteBtn, banBtn, hideBtn].filter(Boolean);
  const actionsHtml = actions.length
    ? `<span class="reply-actions flex items-center gap-3">${actions.join(" ")}</span>`
    : "";

  const attachmentsHtml = (r.attachments || [])
    .map(
      (a) =>
        `<a href="${r.pds_url}/xrpc/com.atproto.sync.getBlob?did=${r.did}&cid=${a.file.ref["$link"]}" target="_blank" class="text-xs text-neutral-500 hover:text-neutral-300 block mt-1">[${escapeHtml(a.name)}]</a>`,
    )
    .join("");

  return `<div class="reply-card border border-neutral-800/50 rounded p-4">
    <div class="flex items-baseline justify-between mb-2">
      <div class="flex items-baseline gap-2">
        <span class="text-neutral-300">${escapeHtml(r.handle)}</span>
        <span class="text-neutral-600">&middot;</span>
        <span class="text-xs text-neutral-500" title="${formatFullDate(r.created_at)}">${relativeDate(r.created_at)}</span>
      </div>
      ${actionsHtml}
    </div>
    ${quoteBlock}
    <p class="text-neutral-400 whitespace-pre-wrap leading-relaxed">${escapeHtml(r.body)}</p>
    ${attachmentsHtml}
  </div>`;
}

async function loadReplies(
  threadDid: string,
  threadTid: string,
  handle: string,
  userDid: string,
  sysopDid: string,
  bannedDids: Set<string>,
  hiddenPosts: Set<string>,
) {
  const container = document.getElementById("replies")!;
  const loading = document.getElementById("replies-loading");
  const threadUri = `at://${threadDid}/${THREAD}/${threadTid}`;

  try {
    const backlinks = await getBacklinks(
      threadUri,
      `${REPLY}:subject`,
      50,
    );

    if (!backlinks.records.length) {
      if (loading) loading.remove();
      if (!userDid) {
        container.innerHTML = '<p class="text-neutral-500">No replies yet.</p>';
      }
      return;
    }

    const records = await getRecordsBatch(backlinks.records);

    // Filter moderated
    const filtered = records.filter(
      (r) =>
        !bannedDids.has(parseAtUri(r.uri).did) &&
        !hiddenPosts.has(r.uri),
    );

    const dids = filtered.map((r) => parseAtUri(r.uri).did);
    const authors = await resolveIdentitiesBatch(dids);

    const replies: ReplyItem[] = filtered
      .filter((r) => parseAtUri(r.uri).did in authors)
      .map((r) => {
        const parsed = parseAtUri(r.uri);
        const author = authors[parsed.did];
        return {
          uri: r.uri,
          did: parsed.did,
          rkey: parsed.rkey,
          handle: author.handle,
          pds_url: author.pds ?? "",
          body: (r.value.body as string) ?? "",
          created_at: (r.value.createdAt as string) ?? "",
          attachments: (r.value.attachments as Attachment[]) ?? [],
          quote: (r.value.quote as string) ?? null,
        };
      })
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

    // Store for quote lookup
    for (const r of replies) {
      allReplies[r.uri] = r;
    }

    if (loading) loading.remove();

    for (const r of replies) {
      container.insertAdjacentHTML(
        "beforeend",
        renderReply(r, handle, threadDid, threadTid, userDid, sysopDid),
      );
    }

    if (container.children.length === 0 && !userDid) {
      container.innerHTML = '<p class="text-neutral-500">No replies yet.</p>';
    }
  } catch {
    if (loading) loading.textContent = "Could not fetch replies.";
  }
}

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

  // Quote clear button
  document.getElementById("quote-clear")?.addEventListener("click", clearQuote);

  // Delegate quote button clicks
  document.getElementById("replies")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(".quote-btn") as HTMLElement | null;
    if (btn) {
      quoteReply(btn.dataset.uri!, btn.dataset.handle!);
    }
  });

  loadReplies(threadDid, threadTid, handle, userDid, sysopDid, bannedDids, hiddenPosts);
}
