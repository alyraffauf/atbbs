/** Resolve a handle to a fully hydrated BBS via Slingshot/Constellation. */

import { resolveIdentity, type MiniDoc } from "./protocol/identities";
import { getRecord, getRecordsByUri, type ATRecord } from "./protocol/records";
import { FetchError } from "./protocol/transport";
import { queryClient } from "./queryClient";
import { SITE } from "./lexicon";
import { parseAtUri } from "./protocol/uri";
import { isBoardRecord, isSiteRecord } from "./recordGuards";
import { MAX_BOARDS } from "./limits";

export class BBSNotFoundError extends Error {}
export class NoBBSError extends Error {}
export class UnsupportedRecordError extends Error {}

export interface Board {
  slug: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PostAttachment {
  file: { ref: { $link: string } };
  name: string;
}

export interface NewsPost {
  uri: string;
  rkey: string;
  title: string;
  body: string;
  createdAt: string;
  attachments?: PostAttachment[];
}

export interface Site {
  name: string;
  description: string;
  intro: string;
  boards: Board[];
  createdAt: string;
  updatedAt?: string;
}

export interface BBS {
  identity: MiniDoc;
  site: Site;
}

export function invalidateAllBBSCaches() {
  queryClient.invalidateQueries({ queryKey: ["bbs"] });
  queryClient.invalidateQueries({ queryKey: ["bbs-moderation"] });
  queryClient.invalidateQueries({ queryKey: ["sysop-moderation"] });
}

export async function resolveBBS(handle: string): Promise<BBS> {
  let identity: MiniDoc;
  try {
    identity = await resolveIdentity(handle);
  } catch (error) {
    if (!(error instanceof FetchError) || error.kind !== "not-found")
      throw error;
    throw new BBSNotFoundError(`Could not resolve handle: ${handle}`);
  }
  if (!identity.pds) {
    throw new BBSNotFoundError(`No PDS for ${handle}`);
  }

  let siteRecord: ATRecord;
  try {
    siteRecord = await getRecord(identity.did, SITE, "self");
  } catch (error) {
    if (!(error instanceof FetchError) || error.kind !== "not-found")
      throw error;
    throw new NoBBSError(`${handle} isn't running a BBS.`);
  }

  if (!isSiteRecord(siteRecord)) {
    throw new NoBBSError(`${handle} has an invalid site record.`);
  }
  const siteValue = siteRecord.value;
  const boardUris: string[] = siteValue.boards ?? [];
  if (boardUris.length > MAX_BOARDS) {
    throw new UnsupportedRecordError(
      `This BBS has more than the supported ${MAX_BOARDS} boards.`,
    );
  }
  for (const uri of boardUris) {
    const parsed = parseAtUri(uri);
    if (
      parsed.did !== identity.did ||
      parsed.collection !== "xyz.atbbs.board"
    ) {
      throw new UnsupportedRecordError(
        "Site record references a foreign board.",
      );
    }
  }

  const boardRecords = await getRecordsByUri(boardUris);

  const boards: Board[] = [];
  boardRecords.forEach((record) => {
    if (!isBoardRecord(record)) return;
    const board = record.value;
    const parsed = parseAtUri(record.uri);
    boards.push({
      slug: parsed.rkey,
      name: board.name,
      description: board.description,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
    });
  });

  return {
    identity,
    site: {
      name: siteValue.name,
      description: siteValue.description,
      intro: siteValue.intro,
      boards,
      createdAt: siteValue.createdAt ?? "",
      updatedAt: siteValue.updatedAt,
    },
  };
}
