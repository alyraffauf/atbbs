/** Authenticated PDS writes with an explicit repository owner. */

import { ok, type Client } from "@atcute/client";
import { SITE, BOARD, POST, BAN, HIDE, PIN, PROFILE } from "./lexicon";
import { invalidateAllBBSCaches } from "./bbs";
import { nowIso } from "./util";
import type { AuthenticatedRepo } from "./repository";
import { MAX_ATTACHMENT_BYTES, MAX_IMAGE_PIXELS } from "./limits";
import type {
  XyzAtbbsPost,
  XyzAtbbsSite,
  XyzAtbbsBoard,
  XyzAtbbsBan,
  XyzAtbbsHide,
  XyzAtbbsPin,
  XyzAtbbsProfile,
} from "../lexicons";

// --- Lexicon value types ---

// Strip $type so a single Attachment value works for posts.
type Attachment = Omit<XyzAtbbsPost.Attachment, "$type">;

type PostValue = Omit<XyzAtbbsPost.Main, "$type">;
type SiteValue = Omit<XyzAtbbsSite.Main, "$type">;
type BoardValue = Omit<XyzAtbbsBoard.Main, "$type">;
type BanValue = Omit<XyzAtbbsBan.Main, "$type">;
type HideValue = Omit<XyzAtbbsHide.Main, "$type">;
type PinValue = Omit<XyzAtbbsPin.Main, "$type">;
type ProfileValue = Omit<XyzAtbbsProfile.Main, "$type">;

interface BlobRef {
  $type: "blob";
  ref: { $link: string };
  mimeType: string;
  size: number;
}

type Did = `did:${string}:${string}`;
type Nsid = `${string}.${string}.${string}`;

const asDid = (value: string) => value as Did;
const asNsid = (value: string) => value as Nsid;

async function createRecord<V extends object>(
  repo: AuthenticatedRepo,
  collection: string,
  value: V,
  rkey?: string,
) {
  const did = asDid(repo.did);
  const rpc = repo.client;
  const record = ok(await rpc.post("com.atproto.repo.createRecord", {
    input: {
      repo: did,
      collection: asNsid(collection),
      ...(rkey ? { rkey } : {}),
      record: { $type: collection, ...value },
    },
  }));
  return record;
}

async function putRecord<V extends object>(
  repo: AuthenticatedRepo,
  collection: string,
  rkey: string,
  value: V,
) {
  const did = asDid(repo.did);
  const rpc = repo.client;
  const record = ok(await rpc.post("com.atproto.repo.putRecord", {
    input: {
      repo: did,
      collection: asNsid(collection),
      rkey,
      record: { $type: collection, ...value },
    },
  }));
  return record;
}

export async function deleteRecord(
  repo: AuthenticatedRepo,
  collection: string,
  rkey: string,
) {
  const did = asDid(repo.did);
  const rpc = repo.client;
  const result = ok(await rpc.post("com.atproto.repo.deleteRecord", {
    input: {
      repo: did,
      collection: asNsid(collection),
      rkey,
    },
  }));
  return result;
}

// --- Blob upload ---

async function stripImageMetadata(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  if (bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) {
    bitmap.close();
    throw new Error("Image exceeds the 40 million-pixel limit");
  }
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: file.type });
  return new File([blob], file.name, { type: file.type });
}

async function uploadBlob(rpc: Client, file: File): Promise<BlobRef> {
  const cleanedFile = await stripImageMetadata(file);
  const result = ok(await rpc.post("com.atproto.repo.uploadBlob", {
    input: cleanedFile,
    headers: {
      "content-type": cleanedFile.type || "application/octet-stream",
    },
  }));
  return result.blob as BlobRef;
}

export async function uploadAttachments(
  repo: AuthenticatedRepo,
  files: File[],
): Promise<Attachment[]> {
  if (files.length === 0) return [];
  const out: Attachment[] = [];
  for (const file of files) {
    if (file.size === 0) continue;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error("Attachment exceeds the 1,000,000-byte limit");
    }
    const blob = await uploadBlob(repo.client, file);
    out.push({
      file: blob as unknown as Attachment["file"],
      name: file.name,
    });
  }
  return out;
}

// --- Posts (threads, replies, news) ---

export async function createPost(
  repo: AuthenticatedRepo,
  scope: string,
  body: string,
  opts?: {
    title?: string;
    root?: string;
    parent?: string;
    attachments?: Attachment[];
  },
) {
  const value: PostValue = {
    scope: scope as PostValue["scope"],
    body,
    createdAt: nowIso(),
    ...(opts?.title ? { title: opts.title } : {}),
    ...(opts?.root ? { root: opts.root as PostValue["root"] } : {}),
    ...(opts?.parent ? { parent: opts.parent as PostValue["parent"] } : {}),
    ...(opts?.attachments?.length ? { attachments: opts.attachments } : {}),
  };
  return createRecord(repo, POST, value);
}

// --- Sysop: site, board ---

export async function createSite(repo: AuthenticatedRepo, site: SiteValue) {
  const resp = await createRecord(repo, SITE, site, "self");
  invalidateAllBBSCaches();
  return resp;
}

export async function putSite(repo: AuthenticatedRepo, site: SiteValue) {
  const resp = await putRecord(repo, SITE, "self", site);
  invalidateAllBBSCaches();
  return resp;
}

export async function putBoard(
  repo: AuthenticatedRepo,
  slug: string,
  name: string,
  description: string,
  createdAt: string,
) {
  const value: BoardValue = {
    name,
    description,
    createdAt: createdAt as BoardValue["createdAt"],
  };
  const resp = await putRecord(repo, BOARD, slug, value);
  invalidateAllBBSCaches();
  return resp;
}

export async function createBoard(
  repo: AuthenticatedRepo,
  slug: string,
  name: string,
  description: string,
  createdAt: string,
) {
  const value: BoardValue = {
    name,
    description,
    createdAt: createdAt as BoardValue["createdAt"],
  };
  const resp = await createRecord(repo, BOARD, value, slug);
  invalidateAllBBSCaches();
  return resp;
}

// --- Sysop: bans & hides ---

async function deterministicRkey(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}

export async function createBan(repo: AuthenticatedRepo, did: string) {
  const value: BanValue = {
    did: did as BanValue["did"],
    createdAt: nowIso(),
  };
  const resp = await createRecord(repo, BAN, value, await deterministicRkey(did));
  invalidateAllBBSCaches();
  return resp;
}

export async function createHide(repo: AuthenticatedRepo, uri: string) {
  const value: HideValue = {
    uri: uri as HideValue["uri"],
    createdAt: nowIso(),
  };
  const resp = await createRecord(repo, HIDE, value, await deterministicRkey(uri));
  invalidateAllBBSCaches();
  return resp;
}

export async function deleteBan(repo: AuthenticatedRepo, rkey: string) {
  const resp = await deleteRecord(repo, BAN, rkey);
  invalidateAllBBSCaches();
  return resp;
}

export async function deleteHide(repo: AuthenticatedRepo, rkey: string) {
  const resp = await deleteRecord(repo, HIDE, rkey);
  invalidateAllBBSCaches();
  return resp;
}

// --- Pins ---

export async function createPin(repo: AuthenticatedRepo, did: string) {
  const value: PinValue = {
    did: did as PinValue["did"],
    createdAt: nowIso(),
  };
  // Use DID as rkey for idempotent pins
  return createRecord(repo, PIN, value, did);
}

// --- Profiles ---

export async function putProfile(
  repo: AuthenticatedRepo,
  name?: string,
  pronouns?: string,
  bio?: string,
) {
  const value: ProfileValue = {
    ...(name ? { name } : {}),
    ...(pronouns ? { pronouns } : {}),
    ...(bio ? { bio } : {}),
    createdAt: nowIso() as ProfileValue["createdAt"],
  };
  return putRecord(repo, PROFILE, "self", value);
}
