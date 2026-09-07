import type { XyzAtbbsBan, XyzAtbbsHide } from "../../lexicons";
import { BAN, HIDE } from "../../config";
import { nowIso } from "../support/time";
import {
  createRecord,
  deleteRecord,
  type AuthenticatedRepo,
} from "../../atproto/repository";

type BanValue = Omit<XyzAtbbsBan.Main, "$type">;
type HideValue = Omit<XyzAtbbsHide.Main, "$type">;

export async function deterministicRkey(value: string) {
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
  return createRecord(repo, BAN, value, await deterministicRkey(did));
}

export async function createHide(repo: AuthenticatedRepo, uri: string) {
  const value: HideValue = {
    uri: uri as HideValue["uri"],
    createdAt: nowIso(),
  };
  return createRecord(repo, HIDE, value, await deterministicRkey(uri));
}

export function deleteBan(repo: AuthenticatedRepo, rkey: string) {
  return deleteRecord(repo, BAN, rkey);
}

export function deleteHide(repo: AuthenticatedRepo, rkey: string) {
  return deleteRecord(repo, HIDE, rkey);
}
