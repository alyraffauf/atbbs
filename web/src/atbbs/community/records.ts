import type { XyzAtbbsBoard, XyzAtbbsSite } from "../../lexicons";
import { BOARD, SITE } from "../../config";
import {
  createRecord,
  putRecord,
  type AuthenticatedRepo,
} from "../../atproto/repository";

type SiteValue = Omit<XyzAtbbsSite.Main, "$type">;
type BoardValue = Omit<XyzAtbbsBoard.Main, "$type">;

interface BoardWrite {
  slug: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt?: string;
}

export async function createSite(repo: AuthenticatedRepo, site: SiteValue) {
  const response = await createRecord(repo, {
    collection: SITE,
    value: site,
    rkey: "self",
  });
  return response;
}

export async function putSite(repo: AuthenticatedRepo, site: SiteValue) {
  const response = await putRecord(repo, {
    collection: SITE,
    rkey: "self",
    value: site,
  });
  return response;
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

export async function putBoard(repo: AuthenticatedRepo, board: BoardWrite) {
  const response = await putRecord(repo, {
    collection: BOARD,
    rkey: board.slug,
    value: boardValue(board),
  });
  return response;
}

export async function createBoard(repo: AuthenticatedRepo, board: BoardWrite) {
  const response = await createRecord(repo, {
    collection: BOARD,
    value: boardValue(board),
    rkey: board.slug,
  });
  return response;
}
