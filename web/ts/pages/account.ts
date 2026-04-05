import { escapeHtml, relativeDate, getData } from "../lib/util";
import {
  listRecords,
  fetchAndHydrate,
  resolveIdentitiesBatch,
  parseAtUri,
  type HydratedRecord,
} from "../lib/atproto";
import { THREAD, REPLY, BACKLINK_LIMIT } from "../lib/lexicon";

interface InboxItem {
  type: string;
  thread_title: string;
  thread_uri: string;
  handle: string;
  body: string;
  created_at: string;
  bbs_handle: string;
}

const SCAN_LIMIT = 50;

// --- Tabs ---

function initTabs() {
  const panels = ["inbox", "bbs"];

  document.querySelectorAll<HTMLElement>(".tab-btn[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.tab!;

      document.querySelectorAll(".tab-btn").forEach((b) => {
        b.classList.remove("text-neutral-200", "border-neutral-200");
        b.classList.add("text-neutral-500", "border-transparent");
      });
      btn.classList.remove("text-neutral-500", "border-transparent");
      btn.classList.add("text-neutral-200", "border-neutral-200");

      for (const p of panels) {
        document.getElementById(`panel-${p}`)?.classList.toggle("hidden", p !== name);
      }
    });
  });
}

// --- Render ---

function renderItem(m: InboxItem, handle: string): HTMLElement {
  const { did: threadDid, rkey: threadRkey } = parseAtUri(m.thread_uri);

  const el = document.createElement("a");
  el.href = `/bbs/${handle}/thread/${threadDid}/${threadRkey}`;
  el.className =
    "block border border-neutral-800/50 rounded p-4 mb-2 hover:bg-neutral-900";
  const label =
    m.type === "quote"
      ? "quoted your reply"
      : "on: " + escapeHtml(m.thread_title);
  el.innerHTML = `<div class="flex items-baseline justify-between mb-1"><span class="text-neutral-300">${escapeHtml(m.handle)}</span><span class="text-xs text-neutral-500">${relativeDate(m.created_at)}</span></div><p class="text-xs text-neutral-500 mb-1">${label}</p><p class="text-neutral-400">${escapeHtml(m.body)}</p>`;
  return el;
}

// --- Data loading ---

function recordsToInboxItems(
  records: HydratedRecord[],
  type: string,
  threadTitle: string,
  threadUri: string,
  bbsHandle: string,
): InboxItem[] {
  return records.map((r) => ({
    type,
    thread_title: threadTitle,
    thread_uri: threadUri,
    handle: r.handle,
    body: ((r.value.body as string) ?? "").substring(0, 200),
    created_at: (r.value.createdAt as string) ?? "",
    bbs_handle: bbsHandle,
  }));
}

function deduplicateItems(items: InboxItem[]): InboxItem[] {
  const seen = new Map<string, InboxItem>();
  for (const item of items) {
    const key = item.handle + item.body + item.created_at;
    if (!seen.has(key) || item.type === "quote") {
      seen.set(key, item);
    }
  }
  return [...seen.values()].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
}

async function loadInbox(did: string, pdsUrl: string, handle: string) {
  const container = document.getElementById("inbox")!;
  const loading = document.getElementById("inbox-loading");

  try {
    const [threadRecords, replyRecords] = await Promise.all([
      listRecords(pdsUrl, did, THREAD, SCAN_LIMIT),
      listRecords(pdsUrl, did, REPLY, SCAN_LIMIT),
    ]);

    // Batch-resolve BBS handles
    const bbsDids = [
      ...new Set(
        threadRecords
          .map((tr) => (tr.value.board as string) ?? "")
          .filter(Boolean)
          .map((uri) => parseAtUri(uri).did),
      ),
    ];
    const bbsAuthors = bbsDids.length
      ? await resolveIdentitiesBatch(bbsDids)
      : {};

    // Fan out all lookups concurrently
    const results = await Promise.all([
      ...threadRecords.map(async (tr) => {
        const boardUri = (tr.value.board as string) ?? "";
        const bbsDid = boardUri ? parseAtUri(boardUri).did : did;
        const bbsHandle = bbsAuthors[bbsDid]?.handle ?? "";

        try {
          const { records } = await fetchAndHydrate(
            tr.uri,
            `${REPLY}:subject`,
            { limit: BACKLINK_LIMIT, excludeDid: did },
          );
          return recordsToInboxItems(
            records,
            "reply",
            (tr.value.title as string) ?? "",
            tr.uri,
            bbsHandle,
          );
        } catch {
          return [];
        }
      }),
      ...replyRecords.map(async (rr) => {
        try {
          const { records } = await fetchAndHydrate(
            rr.uri,
            `${REPLY}:quote`,
            { limit: BACKLINK_LIMIT, excludeDid: did },
          );
          return recordsToInboxItems(
            records,
            "quote",
            "",
            (rr.value.subject as string) ?? "",
            "",
          );
        } catch {
          return [];
        }
      }),
    ]);

    const items = deduplicateItems(results.flat());

    if (loading) loading.remove();

    if (!items.length) {
      container.innerHTML = '<p class="text-neutral-500">No messages yet.</p>';
      return;
    }

    for (const item of items.slice(0, 50)) {
      container.appendChild(renderItem(item, handle));
    }
  } catch {
    if (loading) loading.textContent = "Failed to fetch messages.";
  }
}

// --- Init ---

export function initAccount() {
  initTabs();

  const handle = getData("inbox", "handle");
  const did = getData("inbox", "did");
  const pdsUrl = getData("inbox", "pds");

  if (did && pdsUrl) {
    loadInbox(did, pdsUrl, handle);
  }
}
