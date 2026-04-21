import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

interface LoginModalCtx {
  open: boolean;
  openLogin: () => void;
  closeLogin: () => void;
}

const LoginModalContext = createContext<LoginModalCtx | null>(null);

export function LoginModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openLogin = useCallback(() => setOpen(true), []);
  const closeLogin = useCallback(() => setOpen(false), []);
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
