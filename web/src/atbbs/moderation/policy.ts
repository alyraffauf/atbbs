import type { ModerationState } from "./read";

export interface PostModeration {
  isVisible: boolean;
  isModerated: boolean;
  banRkey: string | null;
  hideRkey: string | null;
}

export function getPostModeration(
  moderation: ModerationState,
  post: { uri: string; did: string },
  viewerDid: string | undefined,
  sysopDid: string,
): PostModeration {
  const banRkey = moderation.banRkeys[post.did]?.[0] ?? null;
  const hideRkey = moderation.hideRkeys[post.uri]?.[0] ?? null;
  const isModerated = !!banRkey || !!hideRkey;
  return {
    isVisible: viewerDid === sysopDid || !isModerated,
    isModerated,
    banRkey,
    hideRkey,
  };
}
