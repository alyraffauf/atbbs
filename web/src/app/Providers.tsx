import { RouterProvider } from "react-router-dom";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { persistOptions } from "../frontend/app/queryPersister";
import { queryClient } from "../frontend/app/queryClient";
import { router } from "./router/routes";

export default function Providers() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
    >
      <RouterProvider router={router} />
      {import.meta.env.DEV && (
        <ReactQueryDevtools buttonPosition="bottom-left" />
      )}
    </PersistQueryClientProvider>
  );
}
