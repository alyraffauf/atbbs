import type { XyzAtbbsBoard } from "../lexicons";
import {
  createRecord,
  deleteRecord,
  getBacklinks,
  getRecord,
  isNotFound,
  listRecords,
  makeAtUri,
  malformed,
  parseAtUri,
  putRecord,
  requireComplete,
  resolveIdentity,
  type ATRecord,
  type AuthenticatedRepo,
} from "@atbbs/atproto";
import { getRecordsByUri } from "../support/records";
import { BAN, BOARD, HIDE, POST, SITE } from "../config";
import { isBoardRecord, isSiteRecord } from "../schema/records";
import { MAX_BOARDS } from "../schema/limits";
import { nowIso } from "../support/time";
import type { Did, RecordKey } from "@atcute/lexicons/syntax";

type BoardValue = Omit<XyzAtbbsBoard.Main, "$type">;

export interface BoardDraft {
  slug: string;
  name: string;
  description: string;
}

export interface CommunityDraft {
  name: string;
  description: string;
  intro: string;
  boards: BoardDraft[];
}

interface BoardWrite extends BoardDraft {
  createdAt: string;
  updatedAt?: string;
}

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

function boardValue(board: BoardWrite): BoardValue {
  return {
    name: board.name,
    description: board.description,
    createdAt: board.createdAt as BoardValue["createdAt"],
    ...(board.updatedAt
      ? { updatedAt: board.updatedAt as BoardValue["updatedAt"] }
      : {}),
  };
}

async function createBoard(
  repo: AuthenticatedRepo,
  board: BoardWrite,
): Promise<void> {
  await createRecord(repo, BOARD, boardValue(board), board.slug);
}

async function putBoard(
  repo: AuthenticatedRepo,
  board: BoardWrite,
): Promise<void> {
  await putRecord(repo, BOARD, board.slug, boardValue(board));
}

export async function createCommunity(
  repo: AuthenticatedRepo,
  draft: CommunityDraft,
): Promise<void> {
  const createdAt = nowIso();
  const createdSlugs: string[] = [];
  try {
    for (const board of draft.boards) {
      await createBoard(repo, { ...board, createdAt });
      createdSlugs.push(board.slug);
    }
    await createRecord(
      repo,
      SITE,
      {
        name: draft.name,
        description: draft.description,
        intro: draft.intro,
        boards: draft.boards.map((board) =>
          makeAtUri(repo.did, BOARD, board.slug as RecordKey),
        ),
        createdAt,
      },
      "self",
    );
  } catch (error) {
    for (const slug of [...createdSlugs].reverse()) {
      try {
        await deleteRecord(repo, BOARD, slug);
      } catch {
        // Preserve the create failure. The remaining record is retryable.
      }
    }
    throw error;
  }
}

export async function updateCommunity(
  repo: AuthenticatedRepo,
  draft: CommunityDraft,
): Promise<void> {
  const updatedAt = nowIso();
  const existing = await getRecord(repo.did, SITE, "self");
  if (!isSiteRecord(existing)) malformed("Existing site record");
  const existingSite = existing.value;
  const existingBoards = new Set<string>();
  for (const boardUri of existingSite.boards) {
    const address = parseAtUri(boardUri);
    if (address.did !== repo.did || address.collection !== BOARD) {
      malformed("Existing site board reference");
    }
    existingBoards.add(address.rkey);
  }

  const boardCreatedAt = new Map<string, string>();
  await Promise.all(
    draft.boards.map(async (board) => {
      if (!existingBoards.has(board.slug)) return;
      const record = await getRecord(repo.did, BOARD, board.slug);
      if (!isBoardRecord(record)) malformed("Existing board record");
      const address = parseAtUri(record.uri);
      if (
        address.did !== repo.did ||
        address.collection !== BOARD ||
        address.rkey !== board.slug
      ) {
        malformed("Existing board record address");
      }
      boardCreatedAt.set(board.slug, record.value.createdAt);
    }),
  );

  for (const board of draft.boards) {
    await putBoard(repo, {
      ...board,
      createdAt: boardCreatedAt.get(board.slug) ?? updatedAt,
      updatedAt,
    });
  }
  await putRecord(repo, SITE, "self", {
    name: draft.name,
    description: draft.description,
    intro: draft.intro,
    boards: draft.boards.map((board) =>
      makeAtUri(repo.did, BOARD, board.slug as RecordKey),
    ),
    createdAt: existingSite.createdAt,
    updatedAt,
  });
  const currentSlugs = new Set(draft.boards.map((board) => board.slug));
  for (const rkey of existingBoards) {
    if (!currentSlugs.has(rkey)) {
      await deleteRecord(repo, BOARD, rkey);
    }
  }
}

export async function deleteCommunity(
  repo: AuthenticatedRepo,
  pdsUrl: string,
): Promise<void> {
  const failed: string[] = [];

  const existing = await getRecord(repo.did, SITE, "self");
  if (!isSiteRecord(existing)) malformed("Existing site record");
  const boardUris = existing.value.boards;

  const boardRkeys = boardUris.map((uri) => {
    const address = parseAtUri(uri);
    if (address.did !== repo.did || address.collection !== BOARD) {
      malformed("Existing site board reference");
    }
    return address.rkey;
  });

  for (const rkey of boardRkeys) {
    try {
      await deleteRecord(repo, BOARD, rkey);
    } catch {
      failed.push(`board/${rkey}`);
    }
  }

  const siteUri = makeAtUri(repo.did as Did, SITE, "self");
  try {
    let cursor: string | undefined;
    const seenCursors = new Set<string>();
    const newsRefs = [];
    for (let page = 0; page < 100; page++) {
      const backlinks = await getBacklinks(siteUri, `${POST}:scope`, {
        limit: 100,
        cursor,
        did: repo.did,
      });
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
    const records = requireComplete(
      await listRecords(pdsUrl, repo.did, collection),
    );
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
