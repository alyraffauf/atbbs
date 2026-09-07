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

export function makeAtUri(
  did: Did,
  collection: Nsid,
  rkey: RecordKey,
): CanonicalResourceUri {
  return `at://${did}/${collection}/${rkey}`;
}
