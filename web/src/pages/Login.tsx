import { MessageSquare, Pin, User, Monitor } from "lucide-react";
import { usePageTitle } from "../hooks/usePageTitle";
import LoginForm from "../components/form/LoginForm";

export default function Login() {
  usePageTitle("Login — atbbs");

  return (
    <div className="h-full flex flex-col justify-center overflow-hidden">
      <div className="text-center mb-8">
        <picture>
          <source
            srcSet="/hero-dark.svg"
            media="(prefers-color-scheme: dark)"
          />
          <img
            src="/hero.svg"
            alt="@bbs"
            className="mx-auto mb-4"
            style={{ width: 140, imageRendering: "pixelated" }}
          />
        </picture>
        <p className="text-neutral-400">
          Use any{" "}
          <a
            href="https://atproto.com"
            className="text-neutral-400 hover:text-neutral-300 underline underline-offset-2"
          >
            AT Protocol
          </a>{" "}
          account.
        </p>
      </div>

      <div className="mb-6">
        <LoginForm />
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded p-4 text-xs text-neutral-400 space-y-3">
        <p>Once signed in, you can:</p>
        <ul className="space-y-2">
          <li className="flex items-center gap-2">
            <MessageSquare size={14} /> Post threads and replies
          </li>
          <li className="flex items-center gap-2">
            <Pin size={14} /> Pin boards you like
          </li>
          <li className="flex items-center gap-2">
            <User size={14} /> Set up a profile
          </li>
          <li className="flex items-center gap-2">
            <Monitor size={14} /> Start your own community
          </li>
        </ul>
        <p className="text-neutral-400 pt-3 border-t border-neutral-800">
          We'll redirect you to your provider to continue.
        </p>
      </div>
    </div>
  );
}
