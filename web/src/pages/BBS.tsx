import { useState } from "react";
import { Link, useRouteLoaderData } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  UserCog,
  Pencil,
  Shield,
  LayoutGrid,
  Newspaper,
  Megaphone,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { usePageTitle } from "../hooks/usePageTitle";
import { truncate } from "../lib/util";
import * as limits from "../lib/limits";
import { newsQuery } from "../lib/queries/community";
import { boardUrl, newsUrl, profileUrl } from "../lib/routes";
import ComposeForm from "../components/form/ComposeForm";
import Localtime from "../components/Localtime";
import ListLink from "../components/nav/ListLink";
import ActionBar from "../components/nav/ActionBar";
import { ActionLink } from "../components/nav/ActionButton";
import PinButton from "../components/PinButton";
import ListSkeleton from "../components/layout/ListSkeleton";
import type { CommunityLoaderData } from "../router/loaders";
import { usePostNews } from "../hooks/useNewsMutations";

const INITIAL_NEWS_COUNT = 3;

export default function BBSPage() {
  const { handle, bbs } = useRouteLoaderData(
    "community",
  ) as CommunityLoaderData;
  const { user } = useAuth();
  const [showAllNews, setShowAllNews] = useState(false);

  const { data: news } = useQuery(newsQuery(bbs.identity.did));
  usePageTitle(`${bbs.site.name} — atbbs`);

  const isSysop = user && user.did === bbs.identity.did;

  const postNews = usePostNews(bbs);

  const visibleNews = news
    ? showAllNews
      ? news
      : news.slice(0, INITIAL_NEWS_COUNT)
    : [];

  return (
    <>
      <div className="mb-8">
        <h1 className="text-lg text-neutral-200 mb-1">{bbs.site.name}</h1>
        <p className="text-neutral-400 mb-3">{bbs.site.description}</p>
        <ActionBar>
          <PinButton bbsDid={bbs.identity.did} />
          <ActionLink to={profileUrl(handle)} icon={UserCog}>
            admin
          </ActionLink>
          {isSysop && (
            <ActionLink to="/account/edit" icon={Pencil}>
              edit
            </ActionLink>
          )}
          {isSysop && (
            <ActionLink to="/account/moderate" icon={Shield}>
              moderate
            </ActionLink>
          )}
        </ActionBar>
      </div>

      {bbs.site.intro && (
        <pre className="bg-neutral-900 border border-neutral-800 rounded p-4 mb-8 overflow-x-auto text-neutral-400 text-xs leading-snug">
          {bbs.site.intro}
        </pre>
      )}

      <section className="mb-8">
        <h2 className="text-xs text-neutral-400 uppercase tracking-wide mb-3 inline-flex items-center gap-1.5">
          <LayoutGrid size={12} /> Boards
        </h2>
        <div className="space-y-1">
          {bbs.site.boards.map((board) => (
            <ListLink
              key={board.slug}
              to={boardUrl(handle, board.slug)}
              name={board.name}
              description={board.description}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs text-neutral-400 uppercase tracking-wide mb-3 inline-flex items-center gap-1.5">
          <Newspaper size={12} /> News
        </h2>

        {isSysop && (
          <details className="mb-4 border border-neutral-800 rounded p-4">
            <summary className="text-neutral-300 cursor-pointer inline-flex items-center gap-1.5">
              <Megaphone size={14} /> post news
            </summary>
            <ComposeForm
              className="mt-4"
              onSave={(draft) => postNews.mutateAsync(draft)}
              title={{
                placeholder: "Headline",
                maxLength: limits.POST_TITLE,
              }}
              bodyPlaceholder="Announcement body..."
              bodyRows={3}
              bodyMaxLength={limits.POST_BODY}
              submitLabel="post"
            />
          </details>
        )}

        {!news ? (
          <ListSkeleton />
        ) : news.length ? (
          <>
            {visibleNews.map((item, i) => (
              <Link
                key={item.rkey}
                to={newsUrl(handle, item.rkey)}
                className={`reply-card block bg-neutral-900 border border-neutral-800 rounded p-4 hover:border-neutral-700 ${i < visibleNews.length - 1 ? "mb-2" : ""}`}
              >
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-neutral-200">{item.title}</span>
                  <span className="text-neutral-400">·</span>
                  <Localtime iso={item.createdAt} />
                </div>
                <div className="line-clamp-3 text-neutral-400">
                  {truncate(item.body, 200)}
                </div>
              </Link>
            ))}
            {!showAllNews && news.length > INITIAL_NEWS_COUNT && (
              <button
                onClick={() => setShowAllNews(true)}
                className="text-neutral-400 hover:text-neutral-300 text-xs mt-2 inline-flex items-center gap-1"
              >
                <ChevronDown size={12} /> show more
              </button>
            )}
          </>
        ) : (
          <p className="text-neutral-400">No news yet.</p>
        )}
      </section>
    </>
  );
}
