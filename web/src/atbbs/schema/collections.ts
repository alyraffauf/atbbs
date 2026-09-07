import shared from "../../../../data/shared.json";

export interface LexiconCollections {
  site: string;
  board: string;
  post: string;
  ban: string;
  hide: string;
  pin: string;
  profile: string;
}

export const COLLECTIONS = shared.lexicon_collections as LexiconCollections;

export const SITE = COLLECTIONS.site as "xyz.atbbs.site";
export const BOARD = COLLECTIONS.board as "xyz.atbbs.board";
export const POST = COLLECTIONS.post as "xyz.atbbs.post";
export const BAN = COLLECTIONS.ban as "xyz.atbbs.ban";
export const HIDE = COLLECTIONS.hide as "xyz.atbbs.hide";
export const PIN = COLLECTIONS.pin as "xyz.atbbs.pin";
export const PROFILE = COLLECTIONS.profile as "xyz.atbbs.profile";
