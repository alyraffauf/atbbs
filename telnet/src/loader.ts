import {
  fetchBBSModeration,
  fetchNews,
  fetchThreadRefs,
  hydrateReplyPage,
  hydrateThreadPage,
  resolveCommunity,
  type Community,
  type ModerationState,
} from "@atbbs/core";
import type { BacklinkRef } from "@atbbs/atproto";

const BBS_CACHE_MS = 5 * 60_000;
const MODERATION_CACHE_MS = 60 * 60_000;
const UPSTREAM_TIMEOUT_MS = 5_000;
const REPLIES_PER_PAGE = 10;
type Cached<T> = { value: T; expiresAt: number };
interface LoadedBbs {
  community: Community;
  moderation: ModerationState;
  news: Awaited<ReturnType<typeof fetchNews>>;
  moderationStale: boolean;
}

/** Application read layer: deadline-bound shared-library calls and BBS caches. */
export class TelnetLoader {
  private readonly bbsCache = new Map<string, Cached<LoadedBbs>>();
  private readonly moderationCache = new Map<string, Cached<ModerationState>>();

  async loadBbs(handle: string, clientSignal: AbortSignal): Promise<LoadedBbs> {
    const cached = this.bbsCache.get(handle);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const community = await this.deadline(
      (signal) => resolveCommunity(handle, { signal }),
      clientSignal,
    );
    const existingModeration = this.moderationCache.get(community.identity.did);
    let moderation: ModerationState;
    let moderationStale = false;
    try {
      moderation = await this.deadline(
        (signal) =>
          fetchBBSModeration(
            community.identity.pds ?? "",
            community.identity.did,
            { signal },
          ),
        clientSignal,
      );
      this.moderationCache.set(community.identity.did, {
        value: moderation,
        expiresAt: Date.now() + MODERATION_CACHE_MS,
      });
    } catch (error) {
      if (!existingModeration) throw error;
      moderation = existingModeration.value;
      moderationStale = true;
    }
    let news: LoadedBbs["news"] = [];
    try {
      news = await this.deadline(
        (signal) => fetchNews(community.identity.did, { moderation, signal }),
        clientSignal,
      );
    } catch {
      /* Python gateway treats unavailable news as empty. */
    }
    const loaded = { community, moderation, news, moderationStale };
    this.bbsCache.set(handle, {
      value: loaded,
      expiresAt: Date.now() + BBS_CACHE_MS,
    });
    return loaded;
  }

  loadThreads(
    bbs: LoadedBbs,
    slug: string,
    cursor: string | null,
    clientSignal: AbortSignal,
  ) {
    return this.deadline(
      (signal) =>
        hydrateThreadPage(bbs.community.identity.did, slug, {
          moderation: bbs.moderation,
          cursor: cursor ?? undefined,
          signal,
        }),
      clientSignal,
    );
  }

  async loadReplies(
    bbs: LoadedBbs,
    threadUri: string,
    page: number,
    savedRefs: BacklinkRef[] | undefined,
    clientSignal: AbortSignal,
  ) {
    const refs =
      savedRefs ??
      (
        await this.deadline(
          (signal) => fetchThreadRefs(threadUri, { signal }),
          clientSignal,
        )
      ).items;
    const hydrated = await this.deadline(
      (signal) =>
        hydrateReplyPage(
          threadUri,
          refs.slice(page * REPLIES_PER_PAGE, (page + 1) * REPLIES_PER_PAGE),
          { moderation: bbs.moderation, signal },
        ),
      clientSignal,
    );
    return {
      refs,
      replies: hydrated.replies,
      page,
      totalPages: Math.max(1, Math.ceil(refs.length / REPLIES_PER_PAGE)),
    };
  }

  private deadline<T>(
    read: (signal: AbortSignal) => Promise<T>,
    clientSignal: AbortSignal,
  ) {
    return read(
      AbortSignal.any([clientSignal, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)]),
    );
  }
}
