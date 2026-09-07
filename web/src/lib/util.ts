export function formatFullDate(iso: string): string {
  const date = new Date(iso);
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function relativeDate(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatFullDate(iso);
}

/** ISO datetime branded so it's assignable to atcute's `datetimeString` types. */
type IsoDatetime = `${number}-${number}-${number}T${string}`;

export function nowIso(): IsoDatetime {
  return new Date().toISOString() as IsoDatetime;
}

import {
  parseCanonicalResourceUri,
  type CanonicalResourceUri,
  type Did,
  type Nsid,
  type RecordKey,
} from "@atcute/lexicons/syntax";

export function parseAtUri(uri: string): {
  did: Did;
  collection: Nsid;
  rkey: RecordKey;
} {
  const { repo, collection, rkey } = parseCanonicalResourceUri(uri);
  return { did: repo, collection, rkey };
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

export function makeAtUri(
  did: Did,
  collection: Nsid,
  rkey: RecordKey,
): CanonicalResourceUri {
  return `at://${did}/${collection}/${rkey}`;
}
