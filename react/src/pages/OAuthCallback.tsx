import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { completeAuthCallback, takePostLoginRedirect } from "../lib/auth";

/**
 * Lands here after the auth server redirects back. completeAuthCallback()
 * reads the OAuth params, scrubs the URL, exchanges them for a session, and
 * adopts it.
 */
export default function OAuthCallback() {
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    completeAuthCallback()
      .then(() => {
        const dest = takePostLoginRedirect() ?? "/";
        nav(dest, { replace: true });
      })
      .catch((e) => {
        console.error(e);
        setError(e?.message ?? "Sign-in failed.");
      });
  }, [nav]);

  if (error) return <p className="text-red-400">{error}</p>;
  return <p className="text-neutral-500">Signing in…</p>;
}
