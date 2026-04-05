import { escapeHtml, relativeDate, getData } from "../lib/util";
import {
  listRecords,
  getBacklinks,
  getRecordsBatch,
  resolveIdentitiesBatch,
  parseAtUri,
} from "../lib/atproto";

interface InboxItem {
  type: string;
  thread_title: string;
  thread_uri: string;
  handle: string;
  body: string;
  created_at: string;
  bbs_handle: string;
}

const THREAD_COLLECTION = "xyz.atboards.thread";
const REPLY_COLLECTION = "xyz.atboards.reply";
const SCAN_LIMIT = 50;
const BACKLINK_LIMIT = 50;

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

async function fetchThreadReplies(
  threadRecord: { uri: string; value: Record<string, unknown> },
  did: string,
  bbsAuthors: Record<string, { handle: string }>,
): Promise<InboxItem[]> {
  const threadUri = threadRecord.uri;
  const threadTitle = (threadRecord.value.title as string) ?? "";
  const boardUri = (threadRecord.value.board as string) ?? "";
  const bbsDid = boardUri ? parseAtUri(boardUri).did : did;
  const bbsHandle = bbsAuthors[bbsDid]?.handle ?? "";

  try {
    const backlinks = await getBacklinks(
      threadUri,
      `${REPLY_COLLECTION}:subject`,
      BACKLINK_LIMIT,
    );
    if (!backlinks.records.length) return [];

    const records = await getRecordsBatch(backlinks.records);
    const others = records.filter((r) => parseAtUri(r.uri).did !== did);
    if (!others.length) return [];

    const dids = others.map((r) => parseAtUri(r.uri).did);
    const authors = await resolveIdentitiesBatch(dids);

    return others
      .filter((r) => parseAtUri(r.uri).did in authors)
      .map((r) => ({
        type: "reply",
        thread_title: threadTitle,
        thread_uri: threadUri,
        handle: authors[parseAtUri(r.uri).did].handle,
        body: ((r.value.body as string) ?? "").substring(0, 200),
        created_at: (r.value.createdAt as string) ?? "",
        bbs_handle: bbsHandle,
      }));
  } catch {
    return [];
  }
}

async function fetchReplyQuotes(
  replyRecord: { uri: string; value: Record<string, unknown> },
  did: string,
): Promise<InboxItem[]> {
  const replyUri = replyRecord.uri;
  const threadUri = (replyRecord.value.subject as string) ?? "";

  try {
    const backlinks = await getBacklinks(
      replyUri,
      `${REPLY_COLLECTION}:quote`,
      BACKLINK_LIMIT,
    );
    if (!backlinks.records.length) return [];

    const records = await getRecordsBatch(backlinks.records);
    const others = records.filter((r) => parseAtUri(r.uri).did !== did);
    if (!others.length) return [];

    const dids = others.map((r) => parseAtUri(r.uri).did);
    const authors = await resolveIdentitiesBatch(dids);

    return others
      .filter((r) => parseAtUri(r.uri).did in authors)
      .map((r) => ({
        type: "quote",
        thread_title: "",
        thread_uri: threadUri,
        handle: authors[parseAtUri(r.uri).did].handle,
        body: ((r.value.body as string) ?? "").substring(0, 200),
        created_at: (r.value.createdAt as string) ?? "",
        bbs_handle: "",
      }));
  } catch {
    return [];
  }
}

async function loadInbox(
  did: string,
  pdsUrl: string,
  handle: string,
) {
  const container = document.getElementById("inbox")!;
  const loading = document.getElementById("inbox-loading");

  try {
    // Fetch thread and reply records concurrently
    const [threadRecords, replyRecords] = await Promise.all([
      listRecords(pdsUrl, did, THREAD_COLLECTION, SCAN_LIMIT),
      listRecords(pdsUrl, did, REPLY_COLLECTION, SCAN_LIMIT),
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
      ...threadRecords.map((tr) => fetchThreadReplies(tr, did, bbsAuthors)),
      ...replyRecords.map((rr) => fetchReplyQuotes(rr, did)),
    ]);

    const allItems: InboxItem[] = results.flat();

    // Deduplicate — prefer quotes
    const seen = new Map<string, InboxItem>();
    for (const item of allItems) {
      const key = item.handle + item.body + item.created_at;
      if (!seen.has(key) || item.type === "quote") {
        seen.set(key, item);
      }
    }

    const items = [...seen.values()].sort(
      (a, b) => b.created_at.localeCompare(a.created_at),
    );

    if (loading) loading.remove();

    if (items.length === 0) {
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

export function initAccount() {
  initTabs();

  const handle = getData("inbox", "handle");
  const did = getData("inbox", "did");
  const pdsUrl = getData("inbox", "pds");

  if (did && pdsUrl) {
    loadInbox(did, pdsUrl, handle);
  }
}
