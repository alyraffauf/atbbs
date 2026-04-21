// App list shared with the Python TUI (see core/atproto_apps.py).
import apps from "../../../core/atproto_apps.json";

export interface AtprotoApp {
  name: string;
  url: string;
}

export const ATPROTO_APPS: AtprotoApp[] = apps;

export function pickRandomApps(count: number): AtprotoApp[] {
  // Shuffle a copy of the list and take the first `count` entries.
  const shuffled = [...ATPROTO_APPS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
