import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { completeAuthCallback, takePostLoginRedirect } from "../lib/auth";

/** Handles the OAuth redirect: exchanges params for a session. */
export default function OAuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    completeAuthCallback()
      .then(() => {
        const dest = takePostLoginRedirect() ?? "/";
        navigate(dest, { replace: true });
      })
      .catch((e) => {
        console.error(e);
        setError(e?.message ?? "Sign-in failed.");
      });
  }, [navigate]);

  if (error) return <p className="text-red-400">{error}</p>;
  return <p className="text-neutral-400">Signing in…</p>;
}
