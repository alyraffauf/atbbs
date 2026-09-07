import { useRouteError } from "react-router-dom";
import ErrorPage from "./ErrorPage";

export default function RouteErrorPage() {
  return <ErrorPage error={useRouteError()} />;
}
