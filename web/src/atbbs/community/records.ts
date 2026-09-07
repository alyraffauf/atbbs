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

export function createSite(repo: AuthenticatedRepo, site: SiteValue) {
  return createRecord(repo, SITE, site, "self");
}

export function putSite(repo: AuthenticatedRepo, site: SiteValue) {
  return putRecord(repo, SITE, "self", site);
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

export function putBoard(repo: AuthenticatedRepo, board: BoardWrite) {
  return putRecord(repo, BOARD, board.slug, boardValue(board));
}

export function createBoard(repo: AuthenticatedRepo, board: BoardWrite) {
  return createRecord(repo, BOARD, boardValue(board), board.slug);
}
