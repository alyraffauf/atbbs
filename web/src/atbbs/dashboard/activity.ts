/** Activity data — replies to your posts from other users. */

import { fetchAndHydrate } from "../discussion/hydration";
import { resolveIdentitiesBatch } from "../identity/service";
import { listRecords } from "../../atproto/records";
import { POST } from "../../config";
import { isPostRecord } from "../schema/records";
import { parseAtUri } from "../../atproto/uri";
import { allSettledBounded, reportPartialFailures } from "../support/batch";

const ACTIVITY_CONCURRENCY = 5;

export interface ActivityItem {
  type: "reply" | "parent_reply";
  threadTitle: string;
  threadUri: string;
  bbsHandle: string;
  replyUri: string;
  handle: string;
  body: string;
  createdAt: string;
}

interface ActivityTarget {
  sourceUri: string;
  backlinkSource: string;
  type: ActivityItem["type"];
  threadTitle: string;
  threadUri: string;
  bbsHandle: string;
}

async function fetchBacklinkItems(
  target: ActivityTarget,
  excludeDid: string,
): Promise<ActivityItem[]> {
  const { records } = await fetchAndHydrate(
    target.sourceUri,
    target.backlinkSource,
    { limit: 50, excludeDid, failureMode: "best-effort" },
  );
  return records.map((record) => ({
    type: target.type,
    threadTitle: target.threadTitle,
    threadUri: target.threadUri,
    bbsHandle: target.bbsHandle,
    replyUri: record.uri,
    handle: record.handle,
    body: ((record.value.body as string) ?? "").substring(0, 200),
    createdAt: (record.value.createdAt as string) ?? "",
  }));
}

export async function fetchActivity(
  did: string,
  pdsUrl: string,
  maxItems = 50,
): Promise<ActivityItem[]> {
  const SCAN_LIMIT = 50;
  const allPosts = (
    await listRecords(pdsUrl, did, POST, {
      pageSize: SCAN_LIMIT,
      maxRecords: SCAN_LIMIT,
      maxPages: 100,
      reverse: true,
    })
  ).items;
  const validPosts = allPosts.filter(isPostRecord);

  const rootPosts = validPosts.filter((record) => !record.value.root);
  const replyPosts = validPosts.filter((record) => !!record.value.root);

  const bbsDids = new Set(
    validPosts.map((record) => parseAtUri(record.value.scope).did),
  );
  const bbsIdentities = await resolveIdentitiesBatch([...bbsDids]);

  const targets = [...rootPosts, ...replyPosts].flatMap(
    (post): ActivityTarget[] => {
      const isReply = !!post.value.root;
      const bbsDid = parseAtUri(post.value.scope).did;
      const bbsHandle = bbsIdentities[bbsDid]?.handle;
      if (!bbsHandle) return [];
      return [
        {
          sourceUri: post.uri,
          backlinkSource: `${POST}:${isReply ? "parent" : "root"}`,
          type: isReply ? "parent_reply" : "reply",
          threadTitle: isReply ? "" : (post.value.title ?? ""),
          threadUri: post.value.root ?? post.uri,
          bbsHandle,
        },
      ];
    },
  );
  const results = await allSettledBounded(
    targets,
    (target) => fetchBacklinkItems(target, did),
    ACTIVITY_CONCURRENCY,
  );
  reportPartialFailures("Activity lookup", results);

  const seen = new Map<string, ActivityItem>();
  const items = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
  for (const item of items) {
    const key = item.replyUri;
    if (!seen.has(key) || item.type === "parent_reply") seen.set(key, item);
  }
  return [...seen.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, maxItems);
}
