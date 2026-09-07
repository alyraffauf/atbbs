/** Resolve a handle to a fully hydrated BBS via Slingshot/Constellation. */

import { resolveIdentity } from "../../atproto/identity";
import { getRecord, type ATRecord } from "../../atproto/records";
import { getRecordsByUri } from "../support/records";
import { isNotFound, malformed } from "../../atproto/transport";
import { BOARD, SITE } from "../../config";
import { parseAtUri } from "../../atproto/uri";
import { isBoardRecord, isSiteRecord } from "../schema/records";
import { MAX_BOARDS } from "../schema/limits";

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

export interface Site {
  name: string;
  description: string;
  intro: string;
  boards: Board[];
  createdAt: string;
  updatedAt?: string;
}

export interface CommunityIdentity {
  did: string;
  handle: string;
  pds?: string;
}

export interface Community {
  identity: CommunityIdentity;
  site: Site;
}

export async function resolveCommunity(handle: string): Promise<Community> {
  let identity: CommunityIdentity;
  try {
    identity = await resolveIdentity(handle);
  } catch (error) {
    if (!isNotFound(error)) throw error;
    throw new BBSNotFoundError(`Could not resolve handle: ${handle}`);
  }
  if (!identity.pds) {
    throw new BBSNotFoundError(`No PDS for ${handle}`);
  }

  let siteRecord: ATRecord;
  try {
    siteRecord = await getRecord(identity.did, SITE, "self");
  } catch (error) {
    if (!isNotFound(error)) throw error;
    throw new NoBBSError(`${handle} isn't running a BBS.`);
  }

  if (!isSiteRecord(siteRecord)) {
    malformed("Site record");
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
  if (boardRecords.length !== boardUris.length) {
    malformed("Site board references");
  }

  const boards: Board[] = [];
  boardRecords.forEach((record) => {
    if (!isBoardRecord(record)) malformed("Board record");
    const board = record.value;
    const parsed = parseAtUri(record.uri);
    if (
      parsed.did !== identity.did ||
      parsed.collection !== BOARD ||
      !boardUris.includes(record.uri)
    ) {
      malformed("Board record address");
    }
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
