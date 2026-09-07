/** Bluesky public API helpers. */

const BSKY_PUBLIC = "https://public.api.bsky.app";

export interface HandleMatch {
  handle: string;
  displayName: string;
  avatar?: string;
}

export async function searchHandles(
  query: string,
  limit = 5,
): Promise<HandleMatch[]> {
  const url =
    `${BSKY_PUBLIC}/xrpc/app.bsky.actor.searchActorsTypeahead` +
    `?q=${encodeURIComponent(query)}&limit=${limit}`;
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const data = (await resp.json()) as {
    actors: {
      handle: string;
      displayName?: string;
      avatar?: string;
    }[];
  };
  return data.actors.map((actor) => ({
    handle: actor.handle,
    displayName: actor.displayName ?? actor.handle,
    avatar: actor.avatar,
  }));
}
