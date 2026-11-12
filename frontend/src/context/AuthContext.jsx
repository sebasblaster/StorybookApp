import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // null = still loading, false = guest, object = user
  const [user, setUser] = useState(null);

  const bootstrap = useCallback(async () => {
    const token = localStorage.getItem("storybook_token");
    if (!token) {
      setUser(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      localStorage.removeItem("storybook_token");
      setUser(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const authenticate = async (path, body) => {
    try {
      const { data } = await api.post(path, body);
      localStorage.setItem("storybook_token", data.token);
      setUser(data.user);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail) || e.message };
    }
  };

  const login = (email, password) => authenticate("/auth/login", { email, password });
  const register = (name, email, password) => authenticate("/auth/register", { name, email, password });

  const logout = async () => {
    localStorage.removeItem("storybook_token");
    setUser(false);
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
  };

  return <AuthContext.Provider value={{ user, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
