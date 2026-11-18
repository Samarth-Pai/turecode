"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User, UserRole } from "@/lib/types";

interface UserContextValue {
  currentUser: User | null;
  enrolledContestIds: string[];
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
  }) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  joinContestByCode: (
    joinCode: string
  ) => Promise<{ ok: boolean; contestId?: string; contestTitle?: string; error?: string }>;
  refreshSession: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  currentUser: null,
  enrolledContestIds: [],
  loading: true,
  login: async () => ({ ok: false }),
  register: async () => ({ ok: false }),
  logout: async () => undefined,
  joinContestByCode: async () => ({ ok: false }),
  refreshSession: async () => undefined,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [enrolledContestIds, setEnrolledContestIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user ?? null);
        setEnrolledContestIds(data.enrolledContestIds ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setCurrentUser(data.user ?? null);
        setEnrolledContestIds(data.enrolledContestIds ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || "Sign in failed" };
    }
    setCurrentUser(data.user);
    setEnrolledContestIds(data.enrolledContestIds ?? []);
    return { ok: true };
  }, []);

  const register = useCallback(
    async (input: { name: string; email: string; password: string; role: UserRole }) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || "Registration failed" };
      }
      setCurrentUser(data.user);
      setEnrolledContestIds(data.enrolledContestIds ?? []);
      return { ok: true };
    },
    []
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setCurrentUser(null);
    setEnrolledContestIds([]);
  }, []);

  const joinContestByCode = useCallback(async (joinCode: string) => {
    const res = await fetch("/api/contests/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ joinCode }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || "Invalid joining code" };
    }
    setEnrolledContestIds(data.enrolledContestIds ?? []);
    return {
      ok: true,
      contestId: data.contest?.id,
      contestTitle: data.contest?.title,
    };
  }, []);

  return (
    <UserContext.Provider
      value={{
        currentUser,
        enrolledContestIds,
        loading,
        login,
        register,
        logout,
        joinContestByCode,
        refreshSession,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
