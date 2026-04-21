import { useEffect } from "react";
import { X } from "lucide-react";
import { useLoginModal } from "../lib/loginModal";
import LoginForm from "./form/LoginForm";

export default function LoginModal() {
  const { open, closeLogin } = useLoginModal();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLogin();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, closeLogin]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Log in"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-16 md:items-center md:pt-0"
      onClick={closeLogin}
    >
      <div
        className="relative w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-lg p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={closeLogin}
          aria-label="Close"
          className="absolute top-3 right-3 text-neutral-500 hover:text-neutral-300"
        >
          <X size={18} />
        </button>
        <h2 className="text-xl text-neutral-200 mb-1">Log in</h2>
        <p className="text-sm text-neutral-400 mb-5">
          Use any{" "}
          <a
            href="https://atproto.com"
            className="hover:text-neutral-300 underline underline-offset-2"
          >
            AT Protocol
          </a>{" "}
          account.
        </p>
        <LoginForm autoFocus idPrefix="login-modal" />
        <p className="text-xs text-neutral-500 mt-4">
          We'll redirect you to your provider to continue.
        </p>
      </div>
    </div>
  );
}
