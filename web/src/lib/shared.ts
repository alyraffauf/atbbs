import shared from "../../../data/shared.json";

export interface AtprotoApp {
  name: string;
  url: string;
}

export interface LexiconCollections {
  site: string;
  board: string;
  post: string;
  ban: string;
  hide: string;
  pin: string;
  profile: string;
}

export interface Services {
  slingshot: string;
  constellation: string;
  lightrail: string;
}

export interface DefaultBoard {
  slug: string;
  name: string;
  description: string;
}

export const ATPROTO_APPS = shared.atproto_apps as AtprotoApp[];
export const LEXICON_COLLECTIONS =
  shared.lexicon_collections as LexiconCollections;
export const SERVICES = shared.services as Services;
export const DEFAULT_BOARD = shared.default_board as DefaultBoard;
export const HANDLE_PLACEHOLDERS = shared.handle_placeholders as string[];
