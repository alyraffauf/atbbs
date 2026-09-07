import { BBSNotFoundError, NoBBSError } from "../../atbbs/community/read";
import { useAuth } from "../../features/auth/auth";
import { isRouteErrorResponse } from "react-router-dom";
import { ActionLink } from "../../shared/ui/ActionButton";

interface ErrorPageProps {
  error: unknown;
}

export default function ErrorPage({ error }: ErrorPageProps) {
  const { user } = useAuth();

  let title = "Something went wrong.";
  let detail: string | null = null;
  let action = { to: "/", label: "← back to home" };

  if (error instanceof BBSNotFoundError) {
    title = "Community not found.";
    detail = "Couldn't resolve that handle. Double-check the spelling.";
  } else if (error instanceof NoBBSError) {
    title = "No community here.";
    if (user) {
      detail = "This account isn't running a community yet.";
    } else {
      detail =
        "This account isn't running a community yet. Is this you? Log in to start one.";
      action = { to: "/?login=1", label: "log in" };
    }
  } else if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Not found." : title;
    detail = typeof error.data === "string" ? error.data : error.statusText;
  } else if (error instanceof Error) {
    detail = error.message;
  }

  return (
    <div className="py-16 text-center">
      <h1 className="text-lg text-neutral-200 mb-2">{title}</h1>
      {detail && <p className="text-neutral-400 mb-6">{detail}</p>}
      <ActionLink to={action.to}>{action.label}</ActionLink>
    </div>
  );
}
