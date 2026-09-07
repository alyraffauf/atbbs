import type { XyzAtbbsBan, XyzAtbbsHide } from "../../../lexicons";
import { invalidateAllBBSCaches } from "../../community/data/bbs";
import { BAN, HIDE } from "../../../atbbs/schema/collections";
import { nowIso } from "../../../atbbs/support/time";
import {
  createRecord,
  deleteRecord,
  type AuthenticatedRepo,
} from "../../../atproto/repository";

type BanValue = Omit<XyzAtbbsBan.Main, "$type">;
type HideValue = Omit<XyzAtbbsHide.Main, "$type">;

async function deterministicRkey(value: string) {
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
  const response = await createRecord(
    repo,
    BAN,
    value,
    await deterministicRkey(did),
  );
  invalidateAllBBSCaches();
  return response;
}

export async function createHide(repo: AuthenticatedRepo, uri: string) {
  const value: HideValue = {
    uri: uri as HideValue["uri"],
    createdAt: nowIso(),
  };
  const response = await createRecord(
    repo,
    HIDE,
    value,
    await deterministicRkey(uri),
  );
  invalidateAllBBSCaches();
  return response;
}

export async function deleteBan(repo: AuthenticatedRepo, rkey: string) {
  const response = await deleteRecord(repo, BAN, rkey);
  invalidateAllBBSCaches();
  return response;
}

export async function deleteHide(repo: AuthenticatedRepo, rkey: string) {
  const response = await deleteRecord(repo, HIDE, rkey);
  invalidateAllBBSCaches();
  return response;
}
