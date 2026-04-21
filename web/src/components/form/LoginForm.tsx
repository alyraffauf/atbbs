import { useState, type SyntheticEvent } from "react";
import { LogIn } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { useHandleSearch } from "../../hooks/useHandleSearch";
import { useDropdown } from "../../hooks/useDropdown";
import HandleInput from "./HandleInput";
import { Button } from "./Form";

interface LoginFormProps {
  autoFocus?: boolean;
  idPrefix?: string;
}

export default function LoginForm({
  autoFocus,
  idPrefix = "login",
}: LoginFormProps) {
  const { login } = useAuth();
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const matches = useHandleSearch(handle);
  const dropdown = useDropdown(matches.length, (index) =>
    selectHandle(matches[index].handle),
  );

  async function onSubmit(event: SyntheticEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(handle.trim());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not log in.");
      setBusy(false);
    }
  }

  function selectHandle(selected: string) {
    setHandle(selected);
    dropdown.close();
  }

  const dropdownOpen = dropdown.focused && matches.length > 0;

  return (
    <>
      {error && <p className="text-red-400 mb-4 text-center">{error}</p>}

      <div
        onFocus={dropdown.onFocus}
        onBlur={dropdown.onBlur}
        onKeyDown={dropdown.onKeyDown}
      >
        <form onSubmit={onSubmit} className="flex gap-2">
          <HandleInput
            name="handle"
            value={handle}
            onChange={setHandle}
            required
            autoFocus={autoFocus}
            className="flex-1"
            aria-autocomplete="list"
            aria-expanded={dropdownOpen}
            aria-activedescendant={
              dropdown.activeIndex >= 0
                ? `${idPrefix}-option-${dropdown.activeIndex}`
                : undefined
            }
            aria-label="Enter your handle"
          />
          <Button type="submit" disabled={busy}>
            {busy ? "..." : <LogIn size={16} />}
          </Button>
        </form>
        {dropdownOpen && (
          <div className="relative">
            <div
              role="listbox"
              className="absolute left-0 right-0 mt-1 bg-neutral-900 border border-neutral-800 rounded shadow-lg z-10"
            >
              {matches.map((match, index) => (
                <button
                  key={match.handle}
                  id={`${idPrefix}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === dropdown.activeIndex}
                  onClick={() => selectHandle(match.handle)}
                  className={`flex items-center gap-3 w-full px-3 py-2 text-left first:rounded-t last:rounded-b ${
                    index === dropdown.activeIndex
                      ? "bg-neutral-800"
                      : "hover:bg-neutral-800"
                  }`}
                >
                  {match.avatar && (
                    <img
                      src={match.avatar}
                      alt=""
                      className="w-6 h-6 rounded-full shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm text-neutral-200 truncate">
                      {match.displayName}
                    </div>
                    <div className="text-xs text-neutral-400 truncate">
                      {match.handle}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
