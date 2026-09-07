export { ATPROTO_APPS, type AtprotoApp } from "../../frontend/features/auth/config";
import { ATPROTO_APPS, type AtprotoApp } from "../../frontend/features/auth/config";

export function pickRandomApps(count: number): AtprotoApp[] {
  const shuffled = [...ATPROTO_APPS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
