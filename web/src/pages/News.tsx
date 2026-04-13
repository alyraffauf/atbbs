import { useNavigate, useParams, useRouteLoaderData } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useBreadcrumb } from "../hooks/useBreadcrumb";
import { usePageTitle } from "../hooks/usePageTitle";
import { NEWS } from "../lib/lexicon";
import { deleteRecord } from "../lib/writes";
import type { BBSLoaderData } from "../router/loaders";
import AttachmentLink from "../components/AttachmentLink";
import PostActions from "../components/PostActions";
import PostBody from "../components/PostBody";
import PostMeta from "../components/PostMeta";

export default function NewsPage() {
  const { handle, tid } = useParams();
  const { bbs } = useRouteLoaderData("bbs") as BBSLoaderData;
  const { user, agent } = useAuth();
  const navigate = useNavigate();

  const item = bbs.news.find((n) => n.tid === tid);

  useBreadcrumb(
    [
      { label: bbs.site.name, to: `/bbs/${handle}` },
      { label: item?.title ?? "News" },
    ],
    [bbs, handle, tid],
  );
  usePageTitle(
    item ? `${item.title} — ${bbs.site.name}` : `News — ${bbs.site.name}`,
  );

  if (!item) {
    return <p className="text-neutral-500">News post not found.</p>;
  }

  const isSysop = !!(user && user.did === bbs.identity.did);

  async function onDelete() {
    if (!agent || !tid) return;
    if (!confirm("Delete this news post?")) return;
    await deleteRecord(agent, NEWS, tid);
    navigate(`/bbs/${handle}`);
  }

  return (
    <article className="bg-neutral-900 border border-neutral-800 rounded p-4">
      <div className="flex items-baseline justify-between mb-3">
        <PostMeta handle={handle ?? ""} createdAt={item.createdAt} />
        <PostActions
          isAuthor={isSysop}
          isSysop={false}
          onDelete={onDelete}
        />
      </div>
      <h1 className="text-lg text-neutral-200 font-bold mb-3">{item.title}</h1>
      <PostBody>{item.body}</PostBody>
      {item.attachments && item.attachments.length > 0 && (
        <div className="mt-3 space-y-1">
          {item.attachments.map((attachment, index) => (
            <AttachmentLink
              key={index}
              pds={bbs.identity.pds ?? ""}
              did={bbs.identity.did}
              cid={attachment.file.ref.$link}
              name={attachment.name}
            />
          ))}
        </div>
      )}
    </article>
  );
}
