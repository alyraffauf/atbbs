import { useLoaderData, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { usePageTitle } from "../hooks/usePageTitle";
import { POST } from "../lib/lexicon";
import { deleteRecord } from "../lib/writes";
import { bbsUrl } from "../lib/routes";
import { alertOnError } from "../lib/alerts";
import NewsCard from "../components/post/NewsCard";
import type { NewsLoaderData } from "../router/loaders";

export default function NewsPage() {
  const { handle, bbs, item } = useLoaderData() as NewsLoaderData;
  const { user, repo } = useAuth();
  const navigate = useNavigate();

  usePageTitle(`${item.title} — ${bbs.site.name}`);

  const isSysop = !!(user && user.did === bbs.identity.did);

  const deleteNewsMutation = useMutation({
    mutationFn: async () => {
      if (!repo) throw new Error("Not signed in");
      await deleteRecord(repo, POST, item.rkey);
    },
    onSuccess: () => navigate(bbsUrl(handle)),
    onError: alertOnError("delete"),
  });

  return (
    <NewsCard
      news={item}
      handle={handle}
      pds={bbs.identity.pds ?? ""}
      did={bbs.identity.did}
      isSysop={isSysop}
      onDelete={() => {
        if (!confirm("Delete this news post?")) return;
        deleteNewsMutation.mutate();
      }}
    />
  );
}
