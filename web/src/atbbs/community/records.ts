import type { XyzAtbbsBoard, XyzAtbbsSite } from "../../lexicons";
import { BOARD, SITE } from "../schema/collections";
import {
  createRecord,
  putRecord,
  type AuthenticatedRepo,
} from "../../atproto/repository";

type SiteValue = Omit<XyzAtbbsSite.Main, "$type">;
type BoardValue = Omit<XyzAtbbsBoard.Main, "$type">;

export async function createSite(repo: AuthenticatedRepo, site: SiteValue) {
  const response = await createRecord(repo, SITE, site, "self");
  return response;
}

export async function putSite(repo: AuthenticatedRepo, site: SiteValue) {
  const response = await putRecord(repo, SITE, "self", site);
  return response;
}

function boardValue(
  name: string,
  description: string,
  createdAt: string,
  updatedAt?: string,
): BoardValue {
  return {
    name,
    description,
    createdAt: createdAt as BoardValue["createdAt"],
    ...(updatedAt ? { updatedAt: updatedAt as BoardValue["updatedAt"] } : {}),
  };
}

export async function putBoard(
  repo: AuthenticatedRepo,
  slug: string,
  name: string,
  description: string,
  createdAt: string,
  updatedAt: string,
) {
  const response = await putRecord(
    repo,
    BOARD,
    slug,
    boardValue(name, description, createdAt, updatedAt),
  );
  return response;
}

export async function createBoard(
  repo: AuthenticatedRepo,
  slug: string,
  name: string,
  description: string,
  createdAt: string,
) {
  const response = await createRecord(
    repo,
    BOARD,
    boardValue(name, description, createdAt),
    slug,
  );
  return response;
}
