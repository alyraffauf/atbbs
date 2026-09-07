import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";

interface LoginModalCtx {
  open: boolean;
  openLogin: () => void;
  closeLogin: () => void;
}

const LoginModalContext = createContext<LoginModalCtx | null>(null);

export function LoginModalProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const open = searchParams.get("login") === "1";
  const openLogin = useCallback(() => {
    setSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      nextParams.set("login", "1");
      return nextParams;
    });
  }, [setSearchParams]);
  const closeLogin = useCallback(() => {
    setSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      nextParams.delete("login");
      return nextParams;
    });
  }, [setSearchParams]);

  return (
    <LoginModalContext.Provider value={{ open, openLogin, closeLogin }}>
      {children}
    </LoginModalContext.Provider>
  );
}

export function useLoginModal(): LoginModalCtx {
  const ctx = useContext(LoginModalContext);
  if (!ctx)
    throw new Error("useLoginModal must be used within LoginModalProvider");
  return ctx;
}
