import { searchActors } from "../../atproto/actors";

export interface HandleMatch {
  handle: string;
  displayName: string;
  avatar?: string;
}

export async function searchHandles(
  query: string,
  limit = 5,
): Promise<HandleMatch[]> {
  const actors = await searchActors(query, limit);
  return actors.map((actor) => ({
    handle: actor.handle,
    displayName: actor.displayName ?? actor.handle,
    avatar: actor.avatar,
  }));
}
