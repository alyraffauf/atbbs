import { createBrowserRouter, Outlet, redirect } from "react-router-dom";

import Layout from "../layout/Layout";
import RouteErrorPage from "../layout/RouteErrorPage";

import Home from "../../pages/Home";
import ProfilePage from "../../features/profile/pages/ProfilePage";
import CommunityPage from "../../features/community/pages/CommunityPage";
import Board from "../../pages/Board";
import Thread from "../../pages/Thread";
import CreateCommunityPage from "../../features/community/pages/CreateCommunityPage";
import EditCommunityPage from "../../features/community/pages/EditCommunityPage";
import ModerationPage from "../../features/moderation/pages/ModerationPage";
import News from "../../pages/News";
import NotFound from "../../pages/NotFound";

import {
  boardLoader,
  communityLoader,
  newsLoader,
  oauthCallbackLoader,
  requireNoBBSLoader,
  requireSysopBBSLoader,
  threadLoader,
  type BoardLoaderData,
  type CommunityLoaderData,
  type NewsLoaderData,
  type SysopBBSLoaderData,
  type ThreadLoaderData,
} from "./loaders";
import { breadcrumbHandle } from "./breadcrumbs";
import { bbsUrl, boardUrl } from "../../shared/config/routes";

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/oauth/callback", loader: oauthCallbackLoader },
      { path: "/account", loader: () => redirect("/") },
      {
        path: "/account/create",
        loader: requireNoBBSLoader,
        element: <CreateCommunityPage />,
      },
      {
        path: "/account/edit",
        loader: requireSysopBBSLoader,
        element: <EditCommunityPage />,
        handle: breadcrumbHandle<SysopBBSLoaderData>(({ user, bbs }) => [
          { label: bbs.site.name, to: bbsUrl(user.handle) },
          { label: "Edit" },
        ]),
      },
      {
        path: "/account/moderate",
        loader: requireSysopBBSLoader,
        element: <ModerationPage />,
        handle: breadcrumbHandle<SysopBBSLoaderData>(({ user, bbs }) => [
          { label: bbs.site.name, to: bbsUrl(user.handle) },
          { label: "Moderate" },
        ]),
      },
      {
        id: "community",
        path: "/bbs/:handle",
        loader: communityLoader,
        element: <Outlet />,
        handle: breadcrumbHandle<CommunityLoaderData>(({ handle, bbs }) => [
          { label: bbs.site.name, to: bbsUrl(handle) },
        ]),
        children: [
          { index: true, element: <CommunityPage /> },
          {
            path: "board/:slug",
            loader: boardLoader,
            element: <Board />,
            handle: breadcrumbHandle<BoardLoaderData>(({ handle, board }) => [
              { label: board.name, to: boardUrl(handle, board.slug) },
            ]),
          },
          {
            path: "thread/:did/:tid",
            loader: threadLoader,
            element: <Thread />,
            handle: breadcrumbHandle<ThreadLoaderData>(
              ({ handle, bbs, thread }) => {
                const board = bbs.site.boards.find(
                  (candidate) => candidate.slug === thread.boardSlug,
                );
                return [
                  ...(board
                    ? [
                        {
                          label: board.name,
                          to: boardUrl(handle, board.slug),
                        },
                      ]
                    : []),
                  { label: thread.title },
                ];
              },
            ),
          },
          {
            path: "news/:tid",
            loader: newsLoader,
            element: <News />,
            handle: breadcrumbHandle<NewsLoaderData>(({ item }) => [
              { label: item.title },
            ]),
          },
        ],
      },
      { path: "/profile/:handle", element: <ProfilePage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
