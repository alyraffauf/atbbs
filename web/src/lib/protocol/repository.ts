import { ok, type Client } from "@atcute/client";
import { MAX_ATTACHMENT_BYTES, MAX_IMAGE_PIXELS } from "../limits";
import type { XyzAtbbsPost } from "../../lexicons";

export interface AuthenticatedRepo {
  client: Client;
  did: `did:${string}:${string}`;
}

type Did = `did:${string}:${string}`;
type Nsid = `${string}.${string}.${string}`;
type Attachment = Omit<XyzAtbbsPost.Attachment, "$type">;

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

async function stripImageMetadata(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  if (bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) {
    bitmap.close();
    throw new Error("Image exceeds the 40 million-pixel limit");
  }
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: file.type });
  return new File([blob], file.name, { type: file.type });
}

async function uploadBlob(client: Client, file: File) {
  const cleanedFile = await stripImageMetadata(file);
  const result = ok(
    await client.post("com.atproto.repo.uploadBlob", {
      input: cleanedFile,
      headers: {
        "content-type": cleanedFile.type || "application/octet-stream",
      },
    }),
  );
  return result.blob;
}

export async function uploadAttachments(
  repo: AuthenticatedRepo,
  files: File[],
): Promise<Attachment[]> {
  const attachments: Attachment[] = [];
  for (const file of files) {
    if (file.size === 0) continue;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error("Attachment exceeds the 1,000,000-byte limit");
    }
    const blob = await uploadBlob(repo.client, file);
    attachments.push({
      file: blob as unknown as Attachment["file"],
      name: file.name,
    });
  }
  return attachments;
}
