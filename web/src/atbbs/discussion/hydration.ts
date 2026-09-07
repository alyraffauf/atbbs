import { getBacklinkCount, getBacklinks } from "../../atproto/backlinks";
import { parseAtUri } from "../../atproto/uri";
import { resolveIdentitiesBatch } from "../identity/service";
import {
  getRecordsBatch,
  type RecordHydrationOptions,
} from "../support/records";

export async function getBacklinkCountsBatch(
  subjects: string[],
  source: string,
) {
  const unique = [...new Set(subjects)];
  const counts = await Promise.all(
    unique.map((subject) => getBacklinkCount(subject, source)),
  );
  return Object.fromEntries(
    unique.map((subject, index) => [subject, counts[index]]),
  );
}

interface HydratedRecord {
  uri: string;
  did: string;
  rkey: string;
  handle: string;
  pds: string;
  value: Record<string, unknown>;
}

export async function fetchAndHydrate(
  subject: string,
  source: string,
  options?: {
    limit?: number;
    cursor?: string;
    excludeDid?: string;
    failureMode?: RecordHydrationOptions["failureMode"];
  },
): Promise<{ records: HydratedRecord[]; cursor: string | null }> {
  const backlinks = await getBacklinks(subject, source, {
    limit: options?.limit,
    cursor: options?.cursor,
  });
  if (!backlinks.records.length) return { records: [], cursor: null };
  const records = await getRecordsBatch(backlinks.records, {
    failureMode: options?.failureMode,
  });
  const filtered = records.filter(
    (record) => parseAtUri(record.uri).did !== options?.excludeDid,
  );
  if (!filtered.length) {
    return { records: [], cursor: backlinks.cursor ?? null };
  }
  const identities = await resolveIdentitiesBatch(
    filtered.map((record) => parseAtUri(record.uri).did),
  );
  const hydrated = filtered.flatMap((record): HydratedRecord[] => {
    const { did, rkey } = parseAtUri(record.uri);
    const identity = identities[did];
    return identity
      ? [
          {
            uri: record.uri,
            did,
            rkey,
            handle: identity.handle,
            pds: identity.pds ?? "",
            value: record.value,
          },
        ]
      : [];
  });
  return { records: hydrated, cursor: backlinks.cursor ?? null };
}
