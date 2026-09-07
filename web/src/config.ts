import shared from "../../data/shared.json" with { type: "json" };

export interface AtprotoApp {
  name: string;
  url: string;
}

interface SharedConfiguration {
  atproto_apps: AtprotoApp[];
  lexicon_collections: {
    site: "xyz.atbbs.site";
    board: "xyz.atbbs.board";
    post: "xyz.atbbs.post";
    ban: "xyz.atbbs.ban";
    hide: "xyz.atbbs.hide";
    pin: "xyz.atbbs.pin";
    profile: "xyz.atbbs.profile";
  };
  oauth_base_scopes: string[];
  services: {
    slingshot: string;
    constellation: string;
    lightrail: string;
  };
  cdn: { url: string; image_format: string };
  default_board: { slug: string; name: string; description: string };
  handle_placeholders: string[];
}

const config = shared as SharedConfiguration;

export const ATPROTO_APPS = config.atproto_apps;
export const HANDLE_PLACEHOLDERS = config.handle_placeholders;
export const COLLECTIONS = config.lexicon_collections;
export const { site: SITE, board: BOARD, post: POST } = COLLECTIONS;
export const { ban: BAN, hide: HIDE, pin: PIN, profile: PROFILE } = COLLECTIONS;
export const SERVICES = config.services;
export const CDN = config.cdn;
export const DEFAULT_BOARD = config.default_board;
export const OAUTH_SCOPE = [
  ...config.oauth_base_scopes,
  ...Object.values(COLLECTIONS).map((nsid) => `repo:${nsid}`),
].join(" ");
