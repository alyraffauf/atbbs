import { Suspense } from "react";
import { Outlet, useLocation, useNavigation } from "react-router-dom";
import { useIsFetching } from "@tanstack/react-query";
import Header from "./Header";
import MobileBackButton from "./MobileBackButton";
import Footer from "./Footer";
import ErrorBoundary from "./ErrorBoundary";
import LoginModal from "../auth/LoginModal";
import { LoginModalProvider } from "../../lib/loginModal";

export default function Layout() {
  const routeLoading = useNavigation().state === "loading";
  const queriesLoading = useIsFetching() > 0;
  const showProgress = routeLoading || queriesLoading;
  // Remount ErrorBoundary + Suspense on navigation so a fresh page doesn't
  // inherit the previous page's error or fallback state.
  const routeKey = useLocation().pathname;

  return (
    <LoginModalProvider>
      <div className="flex flex-col h-dvh">
        {showProgress && (
          <div
            className="fixed top-0 left-0 right-0 h-0.5 bg-neutral-400 z-50"
            style={{ animation: "atbbs-progress 1.5s ease-out infinite" }}
          />
        )}
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-8 flex-1 w-full">
          <MobileBackButton />
          <ErrorBoundary key={routeKey}>
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
        <Footer />
        <LoginModal />
      </div>
    </LoginModalProvider>
  );
}
