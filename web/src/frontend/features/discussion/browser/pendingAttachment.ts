import type { PendingAttachment } from "@atbbs/core/discussion";
import { MAX_IMAGE_PIXELS } from "@atbbs/core/schema";

async function readFile(file: File): Promise<Uint8Array> {
  if (!file.type.startsWith("image/")) {
    return new Uint8Array(await file.arrayBuffer());
  }
  const bitmap = await createImageBitmap(file);
  if (bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) {
    bitmap.close();
    throw new Error("Image exceeds the 40 million-pixel limit");
  }
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: file.type });
  return new Uint8Array(await blob.arrayBuffer());
}

export function pendingAttachmentFromFile(file: File): PendingAttachment {
  return {
    name: file.name,
    mediaType: file.type,
    originalSize: file.size,
    read: () => readFile(file),
  };
}

export function pendingAttachmentsFromFiles(
  files: File[],
): PendingAttachment[] {
  return files.map(pendingAttachmentFromFile);
}
