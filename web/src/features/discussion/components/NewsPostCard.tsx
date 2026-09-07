import type { NewsPost } from "../../../atbbs/community/read";
import PostActions from "./PostActions";
import PostContent from "./PostContent";
import PostMeta from "./PostMeta";

interface NewsPostCardProps {
  news: NewsPost;
  handle: string;
  pds: string;
  did: string;
  isSysop: boolean;
  onDelete: () => void;
}

export default function NewsPostCard({
  news,
  handle,
  pds,
  did,
  isSysop,
  onDelete,
}: NewsPostCardProps) {
  return (
    <article className="bg-neutral-900 border border-neutral-800 rounded p-4">
      <div className="flex items-baseline justify-between mb-3">
        <PostMeta handle={handle} createdAt={news.createdAt} />
        <PostActions
          actions={isSysop ? [{ kind: "delete", onSelect: onDelete }] : []}
        />
      </div>
      <h1 className="text-lg text-neutral-200 font-bold mb-3">{news.title}</h1>
      <PostContent
        body={news.body}
        attachments={news.attachments}
        pds={pds}
        did={did}
        attachmentListClassName="mt-3 space-y-1"
      />
    </article>
  );
}
