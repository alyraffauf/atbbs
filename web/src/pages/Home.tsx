import { useAuth } from "../lib/auth";
import Dashboard from "./Dashboard";
import LoggedOutHome from "./LoggedOutHome";

export default function Home() {
  const { status, user } = useAuth();
  if (status === "loading") return null;
  return user ? <Dashboard user={user} /> : <LoggedOutHome />;
}
