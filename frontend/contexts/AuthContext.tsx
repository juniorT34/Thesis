"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import apiClient, { AuthResponse, UserAccount } from "@/lib/api";

const TOKEN_STORAGE_KEY = "securelink-analyzer.auth.token";
const USER_STORAGE_KEY = "securelink-analyzer.auth.user";

type AuthContextValue = {
  user: UserAccount | null;
  token: string | null;
  initializing: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<AuthResponse | undefined>;
  signUp: (name: string, email: string, password: string) => Promise<AuthResponse | undefined>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const persistSession = (token: string | null, user: UserAccount | null) => {
  if (typeof window === "undefined") return;

  if (token) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    apiClient.setAuthToken(token);
  } else {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    apiClient.setAuthToken(null);
  }

  if (user) {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(USER_STORAGE_KEY);
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const loadSessionFromStorage = useCallback(async () => {
    if (typeof window === "undefined") {
      setInitializing(false);
      return;
    }

    const storedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    const storedUser = window.localStorage.getItem(USER_STORAGE_KEY);

    if (!storedToken) {
      setInitializing(false);
      return;
    }

    setToken(storedToken);
    apiClient.setAuthToken(storedToken);

    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as UserAccount;
        setUser(parsedUser);
        setInitializing(false);
        return;
      } catch (error) {
        console.warn("Failed to parse stored user", error);
      }
    }

    try {
      const response = await apiClient.getProfile();
      if (response.success && response.data?.user) {
        setUser(response.data.user);
        persistSession(storedToken, response.data.user);
      } else {
        persistSession(null, null);
        setUser(null);
        setToken(null);
      }
    } catch (error) {
      console.error("Failed to hydrate profile", error);
      persistSession(null, null);
      setUser(null);
      setToken(null);
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    loadSessionFromStorage();
  }, [loadSessionFromStorage]);

  const refreshProfileFromApi = useCallback(async (overrideToken?: string | null) => {
    try {
      const response = await apiClient.getProfile();
      if (response.success && response.data?.user) {
        const nextToken = overrideToken ?? token;
        setUser(response.data.user);
        persistSession(nextToken, response.data.user);
      }
    } catch (error) {
      console.error("Failed to refresh profile", error);
    }
  }, [token]);

  const handleAuthSuccess = useCallback((payload: AuthResponse | undefined) => {
    if (!payload) return;
    setUser(payload.user);
    setToken(payload.token);
    persistSession(payload.token, payload.user);
  }, []);

  const isApiSuccess = (response: { success?: boolean; status?: boolean }) =>
    response.success === true || response.status === true;

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await apiClient.signIn({ email, password });
    if (isApiSuccess(response) && response.data) {
      handleAuthSuccess(response.data);
      await refreshProfileFromApi(response.data.token);
      return response.data;
    }
    throw new Error(response.message || "Failed to sign in");
  }, [handleAuthSuccess, refreshProfileFromApi]);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const response = await apiClient.signUp({ name, email, password });
    if (isApiSuccess(response) && response.data) {
      handleAuthSuccess(response.data);
      await refreshProfileFromApi(response.data.token);
      return response.data;
    }
    throw new Error(response.message || "Failed to sign up");
  }, [handleAuthSuccess, refreshProfileFromApi]);

  const signOut = useCallback(async () => {
    try {
      await apiClient.signOut();
    } catch (error) {
      console.warn("Sign out request failed", error);
    } finally {
      setUser(null);
      setToken(null);
      persistSession(null, null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    initializing,
    isAdmin: user?.role === "ADMIN",
    signIn,
    signUp,
    signOut,
    refreshProfile: () => refreshProfileFromApi(),
  }), [user, token, initializing, signIn, signUp, signOut, refreshProfileFromApi]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

