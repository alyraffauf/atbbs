import type { PostAttachment } from "../../../atbbs/community/read";
import AttachmentLink from "./AttachmentLink";
import PostBody, { unembeddedAttachments } from "./PostBody";

interface PostContentProps {
  body: string;
  attachments?: PostAttachment[];
  pds: string;
  did: string;
  attachmentListClassName?: string;
}

export default function PostContent({
  body,
  attachments,
  pds,
  did,
  attachmentListClassName,
}: PostContentProps) {
  const remaining = unembeddedAttachments(attachments, body);

  return (
    <>
      <PostBody attachments={attachments} pds={pds} did={did}>
        {body}
      </PostBody>
      {remaining.length > 0 && (
        <div className={attachmentListClassName}>
          {remaining.map((attachment, index) => (
            <AttachmentLink
              key={index}
              pds={pds}
              did={did}
              cid={attachment.file.ref.$link}
              name={attachment.name}
            />
          ))}
        </div>
      )}
    </>
  );
}
