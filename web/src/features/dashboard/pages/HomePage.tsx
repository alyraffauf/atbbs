import { useAuth } from "../../auth/auth";
import DashboardPage from "./DashboardPage";
import LoggedOutHomePage from "./LoggedOutHomePage";

export default function HomePage() {
  const { status, user } = useAuth();
  if (status === "loading") return null;
  return user ? <DashboardPage user={user} /> : <LoggedOutHomePage />;
}
