import type { XyzAtbbsPost } from "../../lexicons";
import { uploadBlob, type AuthenticatedRepo } from "../../atproto/repository";
import { MAX_ATTACHMENT_BYTES } from "../schema/limits";
import { blobUrl } from "../../atproto/blobUrls";
import { cdnImageUrl } from "../media/urls";

export interface AttachmentView {
  name: string;
  downloadUrl: string;
  imageUrl?: string;
}

export interface PendingAttachment {
  name: string;
  mediaType: string;
  originalSize: number;
  read(): Promise<Uint8Array>;
}

type Attachment = Omit<XyzAtbbsPost.Attachment, "$type">;

export function prepareAttachmentViews(
  attachments: Attachment[] | undefined,
  did: string,
  pdsUrl: string,
): AttachmentView[] {
  return (attachments ?? []).flatMap((attachment) => {
    const cid = (attachment.file as { ref?: { $link?: string } }).ref?.$link;
    if (!cid) return [];
    return [
      {
        name: attachment.name,
        downloadUrl: blobUrl(pdsUrl, did, cid),
        imageUrl: cdnImageUrl(did, cid),
      },
    ];
  });
}

export async function uploadAttachments(
  repo: AuthenticatedRepo,
  pendingAttachments: PendingAttachment[],
): Promise<Attachment[]> {
  const attachments: Attachment[] = [];
  for (const pendingAttachment of pendingAttachments) {
    if (pendingAttachment.originalSize === 0) continue;
    if (pendingAttachment.originalSize > MAX_ATTACHMENT_BYTES) {
      throw new Error("Attachment exceeds the 1,000,000-byte limit");
    }
    const bytes = await pendingAttachment.read();
    const blob = await uploadBlob(
      repo.client,
      bytes,
      pendingAttachment.mediaType,
    );
    attachments.push({
      file: blob as unknown as Attachment["file"],
      name: pendingAttachment.name,
    });
  }
  return attachments;
}
