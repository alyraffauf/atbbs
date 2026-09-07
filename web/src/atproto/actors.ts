/** Bluesky public API helpers. */

const BSKY_PUBLIC = "https://public.api.bsky.app";

export interface RawActor {
  handle: string;
  displayName?: string;
  avatar?: string;
}

export async function searchActors(
  query: string,
  limit = 5,
): Promise<RawActor[]> {
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
  if (
    !data ||
    !Array.isArray(data.actors) ||
    data.actors.some((actor) => !actor || typeof actor.handle !== "string")
  ) {
    return [];
  }
  return data.actors;
}
