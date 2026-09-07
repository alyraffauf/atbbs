export { ATPROTO_APPS, type AtprotoApp } from "../../shared/config/shared";
import { ATPROTO_APPS, type AtprotoApp } from "../../shared/config/shared";

export function pickRandomApps(count: number): AtprotoApp[] {
  const shuffled = [...ATPROTO_APPS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
