import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Providers from "./app/Providers";
import "./index.css";

window.addEventListener("pageshow", (event) => {
  if (event.persisted) window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers />
  </StrictMode>,
);
