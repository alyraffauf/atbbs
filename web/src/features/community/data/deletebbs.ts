/** Delete a user's entire BBS: boards, news posts, bans, hides, then the site record. */

import type { AuthenticatedRepo } from "../../../shared/protocol/repository";
import { getBacklinks } from "../../../atproto/backlinks";
import { getRecord, listRecords, requireComplete } from "../../../atproto/records";
import { BAN, BOARD, HIDE, POST, SITE } from "../../../atbbs/schema/collections";
import { makeAtUri, parseAtUri } from "../../../atproto/uri";
import type { Did } from "@atcute/lexicons/syntax";
import { deleteRecord } from "../../../shared/protocol/repository";

export async function deleteBBS(
  repo: AuthenticatedRepo,
  did: string,
  pdsUrl: string,
) {
  const failed: string[] = [];

  const existing = await getRecord(did, SITE, "self");
  const siteValue = existing.value as Record<string, unknown>;
  const boardUris: string[] = (
    Array.isArray(siteValue.boards) ? siteValue.boards : []
  ) as string[];

  // Delete boards
  for (const uri of boardUris) {
    try {
      const { rkey } = parseAtUri(uri);
      await deleteRecord(repo, BOARD, rkey);
    } catch {
      failed.push(`board/${uri}`);
    }
  }

  // Delete sysop's news posts (posts scoped to the site)
  const siteUri = makeAtUri(did as Did, SITE, "self");
  try {
    let cursor: string | undefined;
    const seenCursors = new Set<string>();
    const newsRefs = [];
    for (let page = 0; page < 100; page++) {
      const backlinks = await getBacklinks(
        siteUri,
        `${POST}:scope`,
        100,
        cursor,
        did,
      );
      newsRefs.push(...backlinks.records);
      cursor = backlinks.cursor ?? undefined;
      if (!cursor) break;
      if (seenCursors.has(cursor)) throw new Error("Repeated news cursor");
      seenCursors.add(cursor);
      if (page === 99) throw new Error("News listing exceeded 100 pages");
    }
    for (const ref of newsRefs) {
      try {
        await deleteRecord(repo, POST, ref.rkey);
      } catch {
        failed.push(`post/${ref.rkey}`);
      }
    }
  } catch {
    failed.push("news lookup");
  }

  for (const collection of [BAN, HIDE]) {
    const records = requireComplete(await listRecords(pdsUrl, did, collection));
    for (const record of records) {
      try {
        await deleteRecord(repo, collection, parseAtUri(record.uri).rkey);
      } catch {
        failed.push(`${collection}/${parseAtUri(record.uri).rkey}`);
      }
    }
  }

  if (failed.length) {
    throw new Error(
      `Could not delete: ${failed.join(", ")}. Site record was not deleted.`,
    );
  }

  await deleteRecord(repo, SITE, "self");
}
