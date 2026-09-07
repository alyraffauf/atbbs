import { bbsUrl } from "../../../frontend/app/router/urls";

export interface Suggestion {
  to: string;
  name: string;
  handle: string;
  avatar?: string;
}

export function bbsToSuggestion(bbs: {
  handle: string;
  name: string;
  avatar?: string;
}): Suggestion {
  return {
    to: bbsUrl(bbs.handle),
    name: bbs.name,
    handle: bbs.handle,
    avatar: bbs.avatar,
  };
}
