import { redirect } from "react-router-dom";
import { completeAuthCallback, takePostLoginRedirect } from "../../lib/auth";

export async function oauthCallbackLoader() {
  await completeAuthCallback();
  throw redirect(takePostLoginRedirect() ?? "/");
}
