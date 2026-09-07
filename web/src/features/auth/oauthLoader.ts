import { redirect } from "react-router-dom";
import { completeAuthCallback, takePostLoginRedirect } from "./auth";

export async function oauthCallbackLoader() {
  await completeAuthCallback();
  throw redirect(takePostLoginRedirect() ?? "/");
}
