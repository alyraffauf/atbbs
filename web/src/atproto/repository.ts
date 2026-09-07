import { ok, type Client } from "@atcute/client";

export interface AuthenticatedRepo {
  client: Client;
  did: `did:${string}:${string}`;
}

type Did = `did:${string}:${string}`;
type Nsid = `${string}.${string}.${string}`;

export async function createRecord<V extends object>(
  repo: AuthenticatedRepo,
  collection: string,
  value: V,
  rkey?: string,
) {
  return ok(
    await repo.client.post("com.atproto.repo.createRecord", {
      input: {
        repo: repo.did as Did,
        collection: collection as Nsid,
        ...(rkey ? { rkey } : {}),
        record: { $type: collection, ...value },
      },
    }),
  );
}

export async function putRecord<V extends object>(
  repo: AuthenticatedRepo,
  collection: string,
  rkey: string,
  value: V,
) {
  return ok(
    await repo.client.post("com.atproto.repo.putRecord", {
      input: {
        repo: repo.did as Did,
        collection: collection as Nsid,
        rkey,
        record: { $type: collection, ...value },
      },
    }),
  );
}

export async function deleteRecord(
  repo: AuthenticatedRepo,
  collection: string,
  rkey: string,
) {
  return ok(
    await repo.client.post("com.atproto.repo.deleteRecord", {
      input: {
        repo: repo.did as Did,
        collection: collection as Nsid,
        rkey,
      },
    }),
  );
}

export async function uploadBlob(
  client: Client,
  bytes: Uint8Array,
  mediaType: string,
) {
  const result = ok(
    await client.post("com.atproto.repo.uploadBlob", {
      input: bytes,
      headers: {
        "content-type": mediaType || "application/octet-stream",
      },
    }),
  );
  return result.blob;
}
