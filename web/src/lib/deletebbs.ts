/** Delete a user's entire BBS: boards, news posts, bans, hides, then the site record. */

import type { Client } from "@atcute/client";
import { getRecord, getBacklinks, listRecords } from "./atproto";
import { BAN, BOARD, HIDE, POST, SITE } from "./lexicon";
import { makeAtUri, parseAtUri } from "./util";
import { deleteRecord } from "./writes";

export async function deleteBBS(agent: Client, did: string, pdsUrl: string) {
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
      await deleteRecord(agent, BOARD, rkey);
    } catch {
      failed.push(`board/${uri}`);
    }
  }

  // Delete sysop's news posts (posts scoped to the site)
  const siteUri = makeAtUri(did, SITE, "self");
  try {
    let cursor: string | undefined;
    do {
      const backlinks = await getBacklinks(
        siteUri,
        `${POST}:scope`,
        100,
        cursor,
        did,
      );
      for (const ref of backlinks.records) {
        try {
          await deleteRecord(agent, POST, ref.rkey);
        } catch {
          failed.push(`post/${ref.rkey}`);
        }
      }
      cursor = backlinks.cursor;
    } while (cursor);
  } catch {
    failed.push("news lookup");
  }

  for (const collection of [BAN, HIDE]) {
    const records = await listRecords(pdsUrl, did, collection);
    for (const record of records) {
      try {
        await deleteRecord(agent, collection, parseAtUri(record.uri).rkey);
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

  await deleteRecord(agent, SITE, "self");
}
