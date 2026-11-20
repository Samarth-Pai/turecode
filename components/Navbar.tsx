"use client";

import {
  BookOpen,
  ChevronDown,
  Code2,
  Cpu,
  FileCode2,
  KeyRound,
  Layers,
  LogIn,
  LogOut,
  Menu,
  ShieldCheck,
  Trophy,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { useUser } from "./UserContext";

export function Navbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentUser, enrolledContestIds, joinContestByCode, logout, loading } =
    useUser();

  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinFeedback, setJoinFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement | null>(null);
  const joinRef = useRef<HTMLDivElement | null>(null);

  const isModerator = currentUser?.role === "moderator";
  const currentTab = searchParams.get("tab") || "rounds";

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (joinRef.current && !joinRef.current.contains(e.target as Node)) {
        setJoinOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setProfileOpen(false);
    setMobileOpen(false);
    await logout();
    router.push("/login");
  };

  const handleQuickJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    setJoinBusy(true);
    setJoinFeedback(null);
    try {
      const res = await joinContestByCode(joinCodeInput.trim().toUpperCase());
      if (!res.ok) {
        setJoinFeedback({ ok: false, text: res.error || "Invalid code" });
      } else {
        setJoinFeedback({
          ok: true,
          text: `Joined ${res.contestTitle || "contest"}!`,
        });
        setJoinCodeInput("");
        if (res.contestId) {
          setTimeout(() => {
            setJoinOpen(false);
            setJoinFeedback(null);
            router.push(`/contests/${res.contestId}`);
          }, 500);
        }
      }
    } finally {
      setJoinBusy(false);
    }
  };

  // Dynamic route context pill
  const contextLabel = (() => {
    if (pathname.includes("/rounds/")) return "Live Round Arena";
    if (pathname.startsWith("/contests/")) return "Contest Lobby";
    if (pathname.startsWith("/moderator")) {
      if (currentTab === "bank" || currentTab === "dsl") return "Question Bank";
      if (currentTab === "submissions") return "Submissions Inspector";
      if (currentTab === "leaderboard") return "Contest Leaderboard";
      return "Rounds & Schedules";
    }
    if (pathname.startsWith("/sandbox-status")) return "Landlock Sandbox";
    if (pathname.startsWith("/login")) return "Authentication";
    return "Contest Hub";
  })();

  const moderatorLinks = [
    {
      href: "/moderator?tab=rounds",
      tab: "rounds",
      label: "Rounds",
      icon: Layers,
    },
    {
      href: "/moderator?tab=bank",
      tab: "bank",
      label: "Question Bank",
      icon: BookOpen,
    },
    {
      href: "/moderator?tab=submissions",
      tab: "submissions",
      label: "Submissions",
      icon: FileCode2,
    },
    {
      href: "/moderator?tab=leaderboard",
      tab: "leaderboard",
      label: "Leaderboard",
      icon: ShieldCheck,
    },
    {
      href: "/sandbox-status",
      tab: "sandbox",
      label: "Sandbox",
      icon: Cpu,
    },
  ];

  const isContestsActive =
    pathname === "/" || pathname.startsWith("/contests");

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-[#462E22] border-t-2 border-t-[#CA8A04] bg-[#1D110B] shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        {/* Left: Brand & Dynamic Context Badge */}
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-[#DAA520] bg-[#CA8A04] text-[#110A07] shadow-[0_1px_4px_rgba(202,138,4,0.3)] transition-all duration-300 group-hover:bg-[#B8780A]">
              <Code2 className="h-5 w-5" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-cinzel text-base sm:text-lg font-bold tracking-wider text-[#F5E6D3]">
                TureCode
              </span>
              <span className="font-cinzel text-[9px] font-semibold uppercase tracking-[1.4px] text-[#CA8A04]">
                {contextLabel}
              </span>
            </div>
          </Link>

          <span className="hidden md:inline-block h-6 w-px bg-[#462E22]" />

          {/* Desktop Organized Navigation */}
          <nav className="hidden md:flex items-center gap-1.5">
            <Link
              href="/"
              className={`whitespace-nowrap inline-flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 font-cinzel text-xs font-semibold uppercase tracking-[0.8px] transition-all duration-200 ${
                isContestsActive
                  ? "border border-[#CA8A04] bg-[#2A1810] text-[#F5E6D3] shadow-[0_0_14px_rgba(202,138,4,0.2)]"
                  : "border border-transparent text-[#BFA98A] hover:bg-[#2A1810]/70 hover:text-[#F5E6D3]"
              }`}
            >
              <Trophy className="h-3.5 w-3.5 text-[#CA8A04]" />
              <span>Contests</span>
            </Link>

            {isModerator && (
              <div className="flex items-center gap-1 rounded-[4px] border border-[#462E22] bg-[#110A07] p-0.5 ml-1">
                {moderatorLinks.map((item) => {
                  const Icon = item.icon;
                  const active =
                    item.tab === "sandbox"
                      ? pathname.startsWith("/sandbox-status")
                      : pathname.startsWith("/moderator") &&
                        (currentTab === item.tab ||
                          (item.tab === "bank" && currentTab === "dsl"));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`whitespace-nowrap inline-flex items-center gap-1.5 rounded-[2px] px-2.5 py-1 font-cinzel text-[11px] font-semibold uppercase tracking-[0.6px] transition-all duration-200 ${
                        active
                          ? "bg-[#CA8A04] text-[#110A07] font-bold shadow-[0_0_10px_rgba(202,138,4,0.25)]"
                          : "text-[#BFA98A] hover:bg-[#2A1810] hover:text-[#F5E6D3]"
                      }`}
                    >
                      <Icon
                        className={`h-3 w-3 shrink-0 ${
                          active ? "text-[#110A07]" : "text-[#CA8A04]"
                        }`}
                      />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </nav>
        </div>

        {/* Right: Quick Join by Code + User Menu */}
        <div className="flex items-center gap-2.5">
          {currentUser && (
            <div ref={joinRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setJoinOpen((v) => !v);
                  setJoinFeedback(null);
                }}
                className="whitespace-nowrap inline-flex items-center gap-1.5 rounded-[4px] border border-[#462E22] bg-[#110A07] px-2.5 py-1.5 font-cinzel text-[11px] font-semibold uppercase tracking-[0.6px] text-[#CA8A04] hover:border-[#CA8A04] transition-colors cursor-pointer"
                title="Join a contest with an invite code"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Join Code</span>
              </button>

              {joinOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-[6px] border border-[#462E22] border-t-2 border-t-[#CA8A04] bg-[#1D110B] p-3.5 shadow-[0_12px_32px_rgba(0,0,0,0.7)] z-50">
                  <form onSubmit={handleQuickJoin} className="space-y-2.5">
                    <div className="font-cinzel text-[11px] font-bold uppercase tracking-[0.8px] text-[#F5E6D3]">
                      Enter Contest Join Code
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        value={joinCodeInput}
                        onChange={(e) =>
                          setJoinCodeInput(e.target.value.toUpperCase())
                        }
                        placeholder="e.g. ALGO-2026"
                        className="min-w-0 flex-1 rounded-[4px] border border-[#462E22] bg-[#110A07] px-2.5 py-1.5 font-fira text-xs uppercase text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={joinBusy || !joinCodeInput.trim()}
                        className="rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-3 py-1.5 font-cinzel text-[11px] font-bold uppercase text-[#110A07] hover:bg-[#B8780A] disabled:opacity-50 cursor-pointer"
                      >
                        {joinBusy ? "..." : "Join"}
                      </button>
                    </div>
                    {joinFeedback && (
                      <div
                        className={`font-spectral text-xs ${
                          joinFeedback.ok ? "text-[#22C55E]" : "text-[#F87171]"
                        }`}
                      >
                        {joinFeedback.text}
                      </div>
                    )}
                  </form>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="h-8 w-24 animate-pulse rounded-[4px] bg-[#2A1810]" />
          ) : currentUser ? (
            <div ref={profileRef} className="relative flex items-center gap-2">
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2 rounded-[4px] border border-[#462E22] bg-[#110A07] px-2.5 py-1.5 hover:border-[#CA8A04]/70 transition-colors cursor-pointer"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[#DAA520] bg-[#CA8A04] font-cinzel text-[11px] font-bold text-[#110A07] uppercase">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden sm:block text-left leading-tight">
                  <div className="font-spectral text-xs font-semibold text-[#F5E6D3] max-w-[120px] truncate">
                    {currentUser.name}
                  </div>
                  <div className="font-cinzel text-[9px] uppercase tracking-[1px] text-[#CA8A04]">
                    {currentUser.role}
                  </div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-[#BFA98A]" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 rounded-[6px] border border-[#462E22] border-t-2 border-t-[#CA8A04] bg-[#1D110B] p-3 shadow-[0_12px_32px_rgba(0,0,0,0.7)] z-50 space-y-2.5">
                  <div className="border-b border-[#462E22] pb-2">
                    <div className="font-cinzel text-xs font-bold text-[#F5E6D3]">
                      {currentUser.name}
                    </div>
                    <div className="font-fira text-[11px] text-[#BFA98A]">
                      @{currentUser.handle} • {enrolledContestIds.length} joined
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Link
                      href="/"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 rounded-[4px] px-2.5 py-1.5 font-cinzel text-xs text-[#F5E6D3] hover:bg-[#2A1810]"
                    >
                      <Trophy className="h-3.5 w-3.5 text-[#CA8A04]" />
                      Contest Hub
                    </Link>
                    {isModerator && (
                      <>
                        <Link
                          href="/moderator?tab=rounds"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2 rounded-[4px] px-2.5 py-1.5 font-cinzel text-xs text-[#F5E6D3] hover:bg-[#2A1810]"
                        >
                          <Layers className="h-3.5 w-3.5 text-[#CA8A04]" />
                          Moderator Studio
                        </Link>
                        <Link
                          href="/moderator?tab=bank"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2 rounded-[4px] px-2.5 py-1.5 font-cinzel text-xs text-[#F5E6D3] hover:bg-[#2A1810]"
                        >
                          <BookOpen className="h-3.5 w-3.5 text-[#CA8A04]" />
                          Platform Question Bank
                        </Link>
                        <Link
                          href="/moderator?tab=submissions"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2 rounded-[4px] px-2.5 py-1.5 font-cinzel text-xs text-[#F5E6D3] hover:bg-[#2A1810]"
                        >
                          <FileCode2 className="h-3.5 w-3.5 text-[#CA8A04]" />
                          Participant Submissions
                        </Link>
                      </>
                    )}
                  </div>

                  <div className="border-t border-[#462E22] pt-2">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-[4px] px-2.5 py-1.5 font-cinzel text-xs font-semibold text-[#FCA5A5] hover:bg-[#991B1B]/25 cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#CA8A04] bg-transparent px-3 py-1.5 font-cinzel text-xs font-semibold uppercase tracking-[0.8px] text-[#CA8A04] hover:bg-[#CA8A04]/10 transition-all duration-300"
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign In
              </Link>
              <Link
                href="/login?mode=register"
                className="rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-3 py-1.5 font-cinzel text-xs font-bold uppercase tracking-[0.8px] text-[#110A07] shadow-[0_1px_3px_rgba(202,138,4,0.2)] hover:bg-[#B8780A] transition-all duration-300"
              >
                Get Started
              </Link>
            </div>
          )}

          {/* Mobile Drawer Toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex md:hidden items-center justify-center rounded-[4px] border border-[#462E22] bg-[#110A07] p-1.5 text-[#BFA98A] hover:text-[#F5E6D3] cursor-pointer"
            aria-label="Toggle Menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-b border-[#462E22] bg-[#1D110B] px-4 py-3 space-y-2 shadow-xl">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 rounded-[4px] px-3 py-2 font-cinzel text-xs font-semibold uppercase text-[#F5E6D3] hover:bg-[#2A1810]"
          >
            <Trophy className="h-3.5 w-3.5 text-[#CA8A04]" />
            Contests
          </Link>
          {isModerator &&
            moderatorLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 rounded-[4px] px-3 py-2 font-cinzel text-xs font-semibold uppercase text-[#F5E6D3] hover:bg-[#2A1810]"
                >
                  <Icon className="h-3.5 w-3.5 text-[#CA8A04]" />
                  {item.label}
                </Link>
              );
            })}
        </div>
      )}
    </header>
  );
}
