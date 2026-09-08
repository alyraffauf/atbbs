import type { Client } from "@atcute/client";
import type { AuthenticatedRepo } from "@atbbs/atproto";
import {
  createCommunity,
  deleteCommunity,
  updateCommunity,
  type CommunityDraft,
} from "./community/site";
import { createPin, deletePin } from "./community/pins";
import { createThread, type CreateThreadInput } from "./discussion/threads";
import { createReply, type CreateReplyInput } from "./discussion/replies";
import { createNews, type CreateNewsInput } from "./discussion/news";
import { deletePost, type CreatedPost } from "./discussion/posts";
import {
  createBan,
  createHide,
  deleteBan,
  deleteHide,
} from "./moderation/state";
import { saveProfile, type ProfileDraft } from "./profile/profile";

export type { BoardDraft, CommunityDraft } from "./community/site";
export type { ProfileDraft } from "./profile/profile";

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
    createCommunity: (input) => createCommunity(repo, input),
    updateCommunity: (input) => updateCommunity(repo, input),
    deleteCommunity: () => deleteCommunity(repo, pdsUrl),
    pinCommunity: (did) => createPin(repo, did),
    unpinCommunity: (rkey) => deletePin(repo, rkey),
    createThread: (input) => createThread(repo, pdsUrl, input),
    createReply: (input) => createReply(repo, pdsUrl, input),
    createNews: (input) => createNews(repo, pdsUrl, input),
    deletePost: (rkey) => deletePost(repo, rkey),
    banActor: (did) => createBan(repo, did),
    unbanActor: (rkey) => deleteBan(repo, rkey),
    hidePost: (uri) => createHide(repo, uri),
    unhidePost: (rkey) => deleteHide(repo, rkey),
    saveProfile: (input) => saveProfile(repo, input),
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
