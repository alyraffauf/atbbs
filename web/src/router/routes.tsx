import { createBrowserRouter, Outlet, redirect } from "react-router-dom";

import Layout from "../components/layout/Layout";

import Home from "../pages/Home";
import OAuthCallback from "../pages/OAuthCallback";
import Profile from "../pages/Profile";
import BBS from "../pages/BBS";
import Board from "../pages/Board";
import Thread from "../pages/Thread";
import SysopCreate from "../pages/SysopCreate";
import SysopEdit from "../pages/SysopEdit";
import SysopModerate from "../pages/SysopModerate";
import News from "../pages/News";
import NotFound from "../pages/NotFound";

import { requireAuthLoader, requireSysopBBSLoader } from "./loaders";

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/oauth/callback", element: <OAuthCallback /> },
      { path: "/account", loader: () => redirect("/") },
      {
        path: "/account/create",
        loader: requireAuthLoader,
        element: <SysopCreate />,
      },
      {
        path: "/account/edit",
        loader: requireSysopBBSLoader,
        element: <SysopEdit />,
      },
      {
        path: "/account/moderate",
        loader: requireSysopBBSLoader,
        element: <SysopModerate />,
      },
      {
        path: "/bbs/:handle",
        element: <Outlet />,
        children: [
          { index: true, element: <BBS /> },
          { path: "board/:slug", element: <Board /> },
          { path: "thread/:did/:tid", element: <Thread /> },
          { path: "news/:tid", element: <News /> },
        ],
      },
      { path: "/profile/:handle", element: <Profile /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
