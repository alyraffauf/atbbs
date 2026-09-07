import type { XyzAtbbsBoard, XyzAtbbsSite } from "../../../lexicons";
import { invalidateAllCommunityCaches } from "../../../frontend/features/community/cache";
import { BOARD, SITE } from "../../../atbbs/schema/collections";
import {
  createRecord,
  putRecord,
  type AuthenticatedRepo,
} from "../../../atproto/repository";

type SiteValue = Omit<XyzAtbbsSite.Main, "$type">;
type BoardValue = Omit<XyzAtbbsBoard.Main, "$type">;

export async function createSite(repo: AuthenticatedRepo, site: SiteValue) {
  const response = await createRecord(repo, SITE, site, "self");
  invalidateAllCommunityCaches();
  return response;
}

export async function putSite(repo: AuthenticatedRepo, site: SiteValue) {
  const response = await putRecord(repo, SITE, "self", site);
  invalidateAllCommunityCaches();
  return response;
}

function boardValue(
  name: string,
  description: string,
  createdAt: string,
): BoardValue {
  return {
    name,
    description,
    createdAt: createdAt as BoardValue["createdAt"],
  };
}

export async function putBoard(
  repo: AuthenticatedRepo,
  slug: string,
  name: string,
  description: string,
  createdAt: string,
) {
  const response = await putRecord(
    repo,
    BOARD,
    slug,
    boardValue(name, description, createdAt),
  );
  invalidateAllCommunityCaches();
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
  invalidateAllCommunityCaches();
  return response;
}
