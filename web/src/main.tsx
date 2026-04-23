import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "./lib/queryClient";
import { router } from "./router/routes";
import { BreadcrumbProvider } from "./hooks/useBreadcrumb";
import "./index.css";

window.addEventListener("pageshow", (event) => {
  if (event.persisted) window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BreadcrumbProvider>
        <RouterProvider router={router} />
      </BreadcrumbProvider>
      {import.meta.env.DEV && (
        <ReactQueryDevtools buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  </StrictMode>,
);
