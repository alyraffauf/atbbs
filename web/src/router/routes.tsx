import { createBrowserRouter, Outlet, redirect } from "react-router-dom";

import Layout from "../components/layout/Layout";
import RouteErrorPage from "../components/layout/RouteErrorPage";

import Home from "../pages/Home";
import Profile from "../pages/Profile";
import BBS from "../pages/BBS";
import Board from "../pages/Board";
import Thread from "../pages/Thread";
import SysopCreate from "../pages/SysopCreate";
import SysopEdit from "../pages/SysopEdit";
import SysopModerate from "../pages/SysopModerate";
import News from "../pages/News";
import NotFound from "../pages/NotFound";

import {
  oauthCallbackLoader,
  requireNoBBSLoader,
  requireSysopBBSLoader,
} from "./loaders";

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
