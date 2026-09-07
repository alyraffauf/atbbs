import shared from "../../data/shared.json" with { type: "json" };

export type AtprotoApp = (typeof shared.atproto_apps)[number];

type Nsid = `${string}.${string}.${string}`;
type Collections = {
  [Key in keyof typeof shared.lexicon_collections]: Nsid;
};

export const ATPROTO_APPS = shared.atproto_apps;
export const HANDLE_PLACEHOLDERS = shared.handle_placeholders;
export const COLLECTIONS = shared.lexicon_collections as Collections;
export const { site: SITE, board: BOARD, post: POST } = COLLECTIONS;
export const { ban: BAN, hide: HIDE, pin: PIN, profile: PROFILE } = COLLECTIONS;
export const SERVICES = shared.services;
export const CDN = shared.cdn;
export const DEFAULT_BOARD = shared.default_board;
export const OAUTH_SCOPE = [
  ...shared.oauth_base_scopes,
  ...Object.values(COLLECTIONS).map((nsid) => `repo:${nsid}`),
].join(" ");
