import type { AttachmentView } from "@atbbs/core/discussion";
import AttachmentLink from "./AttachmentLink";
import PostBody, { unembeddedAttachments } from "./PostBody";

interface PostContentProps {
  body: string;
  attachments?: AttachmentView[];
  attachmentListClassName?: string;
}

export default function PostContent({
  body,
  attachments,
  attachmentListClassName,
}: PostContentProps) {
  const remaining = unembeddedAttachments(attachments, body);

  return (
    <>
      <PostBody attachments={attachments}>{body}</PostBody>
      {remaining.length > 0 && (
        <div className={attachmentListClassName}>
          {remaining.map((attachment, index) => (
            <AttachmentLink
              key={index}
              downloadUrl={attachment.downloadUrl}
              name={attachment.name}
            />
          ))}
        </div>
      )}
    </>
  );
}
