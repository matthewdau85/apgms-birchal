import { createContext, useContext, useMemo, useState } from "react";

const STORAGE_KEY = "apgms.auth";

type AuthContextValue = {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const getInitialAuthState = () => {
  if (typeof window === "undefined") {
    return false;
  }
  return window.sessionStorage.getItem(STORAGE_KEY) === "1";
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(getInitialAuthState);

  const value = useMemo<AuthContextValue>(() => ({
    isAuthenticated,
    login: () => {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(STORAGE_KEY, "1");
      }
      setIsAuthenticated(true);
    },
    logout: () => {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
      setIsAuthenticated(false);
    },
  }), [isAuthenticated]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};
