// Internal URL builders. handle/slug are user-authored and encoded;
// did/rkey are AT Proto formats with URL-safe character sets.

export const bbsUrl = (handle: string) =>
  `/bbs/${encodeURIComponent(handle)}`;

export const boardUrl = (handle: string, slug: string) =>
  `/bbs/${encodeURIComponent(handle)}/board/${encodeURIComponent(slug)}`;

export const threadUrl = (handle: string, did: string, rkey: string) =>
  `/bbs/${encodeURIComponent(handle)}/thread/${did}/${rkey}`;

export const newsUrl = (handle: string, rkey: string) =>
  `/bbs/${encodeURIComponent(handle)}/news/${rkey}`;

export const profileUrl = (handle: string) =>
  `/profile/${encodeURIComponent(handle)}`;
