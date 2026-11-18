"use client";

import { Code2, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useState } from "react";
import { useUser } from "@/components/UserContext";
import type { UserRole } from "@/lib/types";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, register } = useUser();

  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("participant");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res =
        mode === "login"
          ? await login(email, password)
          : await register({ name, email, password, role });
      if (!res.ok) {
        setError(res.error || "Authentication failed");
        return;
      }
      router.push("/");
    } finally {
      setBusy(false);
    }
  };

  const quickLogin = async (demoEmail: string) => {
    setError(null);
    setBusy(true);
    try {
      const res = await login(demoEmail, "password123");
      if (!res.ok) {
        setError(res.error || "Failed to sign in");
        return;
      }
      router.push("/");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 transition-opacity duration-300">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[4px] border border-[#DAA520] bg-[#CA8A04] text-[#1A0F0A] shadow-[0_0_20px_rgba(202,138,4,0.4)]">
            <Code2 className="h-6 w-6" />
          </div>
          <h1 className="font-cinzel text-2xl font-bold tracking-wide text-[#F5E6D3]">
            Enter TureCode
          </h1>
          <p className="font-spectral text-sm text-[#BFA98A]">
            {mode === "login"
              ? "Sign in to enter trials, contests, and coding arenas"
              : "Forge your challenger or moderator account"}
          </p>
        </div>

        <div className="rounded-[6px] border border-[#5C3D2E] border-t-2 border-t-[#CA8A04] bg-[#2C1A10] shadow-[0_8px_32px_rgba(202,138,4,0.25)] overflow-hidden">
          <div className="grid grid-cols-2 border-b border-[#5C3D2E] bg-[#1A0F0A] p-1.5 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`rounded-[4px] py-2 font-cinzel text-xs font-semibold uppercase tracking-[1px] transition-all duration-300 cursor-pointer ${
                mode === "login"
                  ? "bg-[#CA8A04] text-[#1A0F0A] shadow-[0_1px_3px_rgba(202,138,4,0.2)]"
                  : "text-[#BFA98A] hover:bg-[#3D2517] hover:text-[#F5E6D3]"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`rounded-[4px] py-2 font-cinzel text-xs font-semibold uppercase tracking-[1px] transition-all duration-300 cursor-pointer ${
                mode === "register"
                  ? "bg-[#CA8A04] text-[#1A0F0A] shadow-[0_1px_3px_rgba(202,138,4,0.2)]"
                  : "text-[#BFA98A] hover:bg-[#3D2517] hover:text-[#F5E6D3]"
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {mode === "register" && (
              <div>
                <label className="block font-spectral text-sm font-medium text-[#F5E6D3] mb-1.5">
                  Full Name
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full h-10 rounded-[4px] border border-[#5C3D2E] bg-[#1A0F0A] px-3 py-2 font-spectral text-sm text-[#F5E6D3] placeholder:text-[#BFA98A]/50 hover:border-[#CA8A04] focus:border-2 focus:border-[#CA8A04] focus:ring-[3px] focus:ring-[#CA8A04]/25 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="block font-spectral text-sm font-medium text-[#F5E6D3] mb-1.5">
                Email Address
              </label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-10 rounded-[4px] border border-[#5C3D2E] bg-[#1A0F0A] px-3 py-2 font-spectral text-sm text-[#F5E6D3] placeholder:text-[#BFA98A]/50 hover:border-[#CA8A04] focus:border-2 focus:border-[#CA8A04] focus:ring-[3px] focus:ring-[#CA8A04]/25 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-spectral text-sm font-medium text-[#F5E6D3] mb-1.5">
                Password
              </label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-10 rounded-[4px] border border-[#5C3D2E] bg-[#1A0F0A] px-3 py-2 font-spectral text-sm text-[#F5E6D3] placeholder:text-[#BFA98A]/50 hover:border-[#CA8A04] focus:border-2 focus:border-[#CA8A04] focus:ring-[3px] focus:ring-[#CA8A04]/25 focus:outline-none"
              />
            </div>

            {mode === "register" && (
              <div>
                <label className="block font-spectral text-sm font-medium text-[#F5E6D3] mb-1.5">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full h-10 rounded-[4px] border border-[#5C3D2E] bg-[#1A0F0A] px-3 py-2 font-spectral text-sm text-[#F5E6D3] hover:border-[#CA8A04] focus:border-2 focus:border-[#CA8A04] focus:outline-none"
                >
                  <option value="participant">Contest Participant</option>
                  <option value="moderator">Contest Moderator / Organizer</option>
                </select>
              </div>
            )}

            {error && (
              <div className="rounded-[4px] border border-[#B91C1C] bg-[#991B1B]/25 px-3 py-2 font-spectral text-xs text-[#F87171]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-10 rounded-[4px] border border-[#DAA520] bg-[#CA8A04] font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#1A0F0A] shadow-[0_2px_8px_rgba(202,138,4,0.25)] hover:bg-[#B8780A] disabled:opacity-35 disabled:cursor-not-allowed transition-all duration-300 cursor-pointer"
            >
              {busy
                ? "Authenticating..."
                : mode === "login"
                ? "Sign In"
                : "Create Account"}
            </button>
          </form>

          <div className="border-t border-[#5C3D2E] bg-[#1A0F0A]/70 px-6 py-4 space-y-2.5">
            <div className="flex items-center gap-1.5 font-cinzel text-[11px] font-semibold uppercase tracking-[1px] text-[#BFA98A]">
              <Sparkles className="h-3.5 w-3.5 text-[#CA8A04]" />
              Quick Demo Access
            </div>
            <div className="grid gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => quickLogin("samarth@turecode.dev")}
                className="flex items-center justify-between rounded-[4px] border border-[#5C3D2E] bg-[#2C1A10] px-3 py-2 text-left text-xs hover:border-[#CA8A04] hover:bg-[#3D2517] transition-all duration-300 cursor-pointer"
              >
                <span className="font-spectral text-[#BFA98A]">
                  <strong className="text-[#F5E6D3]">Samarth Pai</strong>{" "}
                  (samarth@turecode.dev)
                </span>
                <span className="inline-flex items-center gap-1 rounded-[2px] border border-[#581C87] bg-[#581C87]/35 px-2 py-0.5 font-cinzel text-[10px] uppercase tracking-[1px] text-[#E9D5FF]">
                  <ShieldCheck className="h-3 w-3" />
                  Moderator
                </span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => quickLogin("priya@turecode.dev")}
                className="flex items-center justify-between rounded-[4px] border border-[#5C3D2E] bg-[#2C1A10] px-3 py-2 text-left text-xs hover:border-[#CA8A04] hover:bg-[#3D2517] transition-all duration-300 cursor-pointer"
              >
                <span className="font-spectral text-[#BFA98A]">
                  <strong className="text-[#F5E6D3]">Priya Patel</strong>{" "}
                  (priya@turecode.dev)
                </span>
                <span className="inline-flex items-center gap-1 rounded-[2px] bg-[#CA8A04]/20 px-2 py-0.5 font-cinzel text-[10px] uppercase tracking-[1px] text-[#CA8A04]">
                  <UserCheck className="h-3 w-3" />
                  Participant
                </span>
              </button>
            </div>
            <p className="font-spectral text-xs text-[#BFA98A]/80 pt-1">
              Demo join codes:{" "}
              <code className="font-fira text-[#CA8A04]">ALGO-2026</code>,{" "}
              <code className="font-fira text-[#CA8A04]">BLITZ-14</code>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-center font-spectral text-sm text-[#BFA98A]">
          Loading Sign In...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
