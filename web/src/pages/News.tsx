import { useLoaderData } from "react-router-dom";
import { useAuth } from "../features/auth/auth";
import { usePageTitle } from "../shared/hooks/usePageTitle";
import NewsCard from "../components/post/NewsCard";
import type { NewsLoaderData } from "../app/router/loaders";
import { useDeleteNews } from "../hooks/useNewsMutations";

export default function NewsPage() {
  const { handle, bbs, item } = useLoaderData() as NewsLoaderData;
  const { user } = useAuth();

  usePageTitle(`${item.title} — ${bbs.site.name}`);

  const isSysop = !!(user && user.did === bbs.identity.did);

  const deleteNews = useDeleteNews(handle, item.rkey);

  return (
    <NewsCard
      news={item}
      handle={handle}
      pds={bbs.identity.pds ?? ""}
      did={bbs.identity.did}
      isSysop={isSysop}
      onDelete={() => {
        if (!confirm("Delete this news post?")) return;
        deleteNews.mutate();
      }}
    />
  );
}
