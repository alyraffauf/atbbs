import shared from "../../../../../data/shared.json";

export interface AtprotoApp {
  name: string;
  url: string;
}

export const ATPROTO_APPS = shared.atproto_apps as AtprotoApp[];
export const HANDLE_PLACEHOLDERS = shared.handle_placeholders as string[];

export function pickRandomApps(count: number): AtprotoApp[] {
  const shuffled = [...ATPROTO_APPS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
