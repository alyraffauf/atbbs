import type { AuthenticatedRepo } from "../atproto/repository";
import type { Client } from "@atcute/client";
import { deleteRecord } from "../atproto/repository";
import { getRecord } from "../atproto/records";
import { malformed } from "../atproto/transport";
import { makeAtUri, parseAtUri } from "../atproto/uri";
import type { RecordKey } from "@atcute/lexicons/syntax";
import {
  createBoard,
  createSite,
  putBoard,
  putSite,
} from "./community/records";
import { deleteBBS } from "./community/delete";
import { createPin } from "./community/pinCommands";
import {
  createNews,
  createReply,
  createThread,
  deletePost,
  type CreatedPost,
  type CreateNewsInput,
  type CreateReplyInput,
  type CreateThreadInput,
} from "./discussion/commands";
import {
  createBan,
  createHide,
  deleteBan,
  deleteHide,
} from "./moderation/commands";
import { putProfile } from "./profile/commands";
import { BOARD, PIN, SITE } from "../config";
import { isBoardRecord, isSiteRecord } from "./schema/records";
import { nowIso } from "./support/time";

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

export interface ProfileDraft {
  name?: string;
  pronouns?: string;
  bio?: string;
}

export interface AtbbsWriter {
  createCommunity(input: CommunityDraft): Promise<void>;
  updateCommunity(input: CommunityDraft): Promise<void>;
  deleteCommunity(): Promise<void>;
  pinCommunity(did: string): Promise<void>;
  unpinCommunity(rkey: string): Promise<void>;
  createThread(input: CreateThreadInput): Promise<CreatedPost>;
  createReply(input: CreateReplyInput): Promise<CreatedPost>;
  createNews(input: CreateNewsInput): Promise<CreatedPost>;
  deletePost(rkey: string): Promise<void>;
  banActor(did: string): Promise<void>;
  unbanActor(rkey: string): Promise<void>;
  hidePost(uri: string): Promise<void>;
  unhidePost(rkey: string): Promise<void>;
  saveProfile(input: ProfileDraft): Promise<void>;
}

export function createAtbbsWriter(
  repo: AuthenticatedRepo,
  pdsUrl: string,
): AtbbsWriter {
  return {
    async createCommunity(draft) {
      const createdAt = nowIso();
      const createdSlugs: string[] = [];
      try {
        for (const board of draft.boards) {
          await createBoard(repo, { ...board, createdAt });
          createdSlugs.push(board.slug);
        }
        await createSite(repo, {
          name: draft.name,
          description: draft.description,
          intro: draft.intro,
          boards: draft.boards.map((board) =>
            makeAtUri(repo.did, BOARD, board.slug as RecordKey),
          ),
          createdAt,
        });
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
    },

    async updateCommunity(draft) {
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
      await putSite(repo, {
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
    },

    deleteCommunity: () => deleteBBS(repo, repo.did, pdsUrl),
    async pinCommunity(did) {
      await createPin(repo, did);
    },
    async unpinCommunity(rkey) {
      await deleteRecord(repo, PIN, rkey);
    },
    createThread: (input) => createThread(repo, pdsUrl, input),
    createReply: (input) => createReply(repo, pdsUrl, input),
    createNews: (input) => createNews(repo, pdsUrl, input),
    deletePost: (rkey) => deletePost(repo, rkey),
    async banActor(did) {
      await createBan(repo, did);
    },
    async unbanActor(rkey) {
      await deleteBan(repo, rkey);
    },
    async hidePost(uri) {
      await createHide(repo, uri);
    },
    async unhidePost(rkey) {
      await deleteHide(repo, rkey);
    },
    async saveProfile(input) {
      await putProfile(repo, input.name, input.pronouns, input.bio);
    },
  };
}

export function createAtbbsWriterForSession(
  client: Client,
  did: string,
  pdsUrl: string,
): AtbbsWriter {
  return createAtbbsWriter(
    { client, did: did as AuthenticatedRepo["did"] },
    pdsUrl,
  );
}
