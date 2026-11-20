"use client";

import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Copy,
  KeyRound,
  Layers,
  ShieldAlert,
  Sparkles,
  Terminal,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import { useUser } from "@/components/UserContext";
import { getRoundStatus, type Contest, type Question } from "@/lib/types";

interface ContestsPayload {
  contests: Contest[];
  questions: Question[];
  stats: {
    totalContests: number;
    totalQuestions: number;
    totalSubmissions: number;
  };
}

function StatusPill({ status }: { status: "UPCOMING" | "ACTIVE" | "ENDED" }) {
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[2px] bg-[#22C55E]/20 px-3 py-1 font-cinzel text-[11px] uppercase tracking-[1px] text-[#22C55E]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
        Live Now
      </span>
    );
  }
  if (status === "UPCOMING") {
    return (
      <span className="inline-flex items-center rounded-[2px] bg-[#CA8A04]/20 px-3 py-1 font-cinzel text-[11px] uppercase tracking-[1px] text-[#CA8A04]">
        Upcoming
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-[2px] bg-[#991B1B]/25 px-3 py-1 font-cinzel text-[11px] uppercase tracking-[1px] text-[#F87171]">
      Ended
    </span>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { currentUser, enrolledContestIds, joinContestByCode } = useUser();
  const [data, setData] = useState<ContestsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "upcoming">("all");

  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinFeedback, setJoinFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const [inlineJoinContestId, setInlineJoinContestId] = useState<string | null>(null);
  const [inlineCode, setInlineCode] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/contests", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/contests", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (active && json) setData(json);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentUser?.id]);

  const handleJoinSubmit = async (code: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      router.push("/login");
      return;
    }
    setJoinFeedback(null);
    setJoinBusy(true);
    try {
      const res = await joinContestByCode(code);
      if (!res.ok) {
        setJoinFeedback({ type: "err", text: res.error || "Invalid joining code" });
        return;
      }
      setJoinFeedback({
        type: "ok",
        text: `Enrolled in "${res.contestTitle}"!`,
      });
      setJoinCodeInput("");
      setInlineJoinContestId(null);
      setInlineCode("");
      await loadData();
      if (res.contestId) {
        router.push(`/contests/${res.contestId}`);
      }
    } finally {
      setJoinBusy(false);
    }
  };

  const copyCode = (contestId: string, code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedId(contestId);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const isModerator = currentUser?.role === "moderator";
  const contests = data?.contests ?? [];

  const filteredContests = contests.filter((c) => {
    if (filter === "all") return true;
    const statuses = c.rounds.map((r) => getRoundStatus(r));
    if (filter === "active") return statuses.includes("ACTIVE");
    if (filter === "upcoming") return statuses.includes("UPCOMING");
    return true;
  });

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 space-y-8">
      {/* QuestUI Hero Banner */}
      <section className="rounded-[4px] border border-[#462E22] border-t-2 border-t-[#CA8A04] bg-[#1D110B] p-6 sm:p-8 shadow-[0_4px_16px_rgba(202,138,4,0.22)] transition-all duration-300">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-[2px] border border-[#581C87] bg-[#581C87]/35 px-3 py-1 font-cinzel text-[11px] uppercase tracking-[1px] text-[#E9D5FF]">
              <Sparkles className="h-3.5 w-3.5 text-[#CA8A04]" />
              Multi-Round Coding & MCQ Trials
            </div>
            <h1 className="font-cinzel text-3xl sm:text-[40px] font-bold leading-[1.15] text-[#F5E6D3]">
              Prove Your Craft in the{" "}
              <span className="text-[#CA8A04]">Coding Arena</span>
            </h1>
            <p className="font-spectral text-base text-[#BFA98A] leading-[1.7]">
              Join a contest using your guild invite code, conquer timed MCQ and Coding
              rounds across C, C++, Java, and Python, and forge solutions in a flexible IDE.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {isModerator ? (
              <Link
                href="/moderator?newContest=1"
                className="inline-flex items-center gap-2 rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-6 py-3 font-cinzel text-sm font-bold uppercase tracking-[1px] text-[#110A07] shadow-[0_2px_8px_rgba(202,138,4,0.25)] hover:bg-[#B8780A] transition-all duration-300"
              >
                + Create New Contest
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : !currentUser ? (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-6 py-3 font-cinzel text-sm font-bold uppercase tracking-[1px] text-[#110A07] shadow-[0_2px_8px_rgba(202,138,4,0.25)] hover:bg-[#B8780A] transition-all duration-300"
              >
                Sign In to Participate
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Main Feed */}
        <div className="lg:col-span-8 space-y-6">
          {/* Join Contest by Code Card */}
          <div className="rounded-[4px] border border-[#462E22] bg-[#1D110B] p-6 shadow-[0_2px_8px_rgba(202,138,4,0.2)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] border border-[#CA8A04]/40 bg-[#2A1810] text-[#CA8A04]">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-cinzel text-base font-semibold text-[#F5E6D3]">
                    Join a Contest via Joining Code
                  </h2>
                  <p className="font-spectral text-sm text-[#BFA98A] mt-0.5">
                    Enter the invite code shared by your contest moderator to unlock rounds.
                  </p>
                </div>
              </div>

              <form
                onSubmit={(e) => handleJoinSubmit(joinCodeInput, e)}
                className="flex items-center gap-2 shrink-0"
              >
                <input
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="E.G. ALGO-2026"
                  className="w-40 h-10 rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-2 font-fira text-xs font-semibold uppercase text-[#F5E6D3] placeholder:text-[#BFA98A]/50 hover:border-[#CA8A04] focus:border-2 focus:border-[#CA8A04] focus:ring-[3px] focus:ring-[#CA8A04]/25 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={joinBusy || !joinCodeInput.trim()}
                  className="h-10 rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-5 font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#110A07] shadow-[0_1px_3px_rgba(202,138,4,0.2)] hover:bg-[#B8780A] disabled:opacity-35 disabled:cursor-not-allowed transition-all duration-300 cursor-pointer"
                >
                  {joinBusy ? "Joining..." : "Join"}
                </button>
              </form>
            </div>

            {joinFeedback && (
              <div
                className={`mt-4 rounded-[4px] border px-3.5 py-2.5 font-spectral text-xs ${
                  joinFeedback.type === "ok"
                    ? "border-[#22C55E]/40 bg-[#22C55E]/15 text-[#22C55E]"
                    : "border-[#B91C1C] bg-[#991B1B]/25 text-[#F87171]"
                }`}
              >
                {joinFeedback.text}
              </div>
            )}
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-2 border-b border-[#462E22] pb-3">
            {[
              { id: "all", label: `All Contests (${contests.length})` },
              { id: "active", label: "Live Now" },
              { id: "upcoming", label: "Upcoming" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilter(t.id as "all" | "active" | "upcoming")}
                className={`rounded-[2px] px-3 py-1 font-cinzel text-[11px] uppercase tracking-[1px] transition-all duration-300 cursor-pointer ${
                  filter === t.id
                    ? "bg-[#CA8A04] text-[#110A07] font-bold shadow-[0_1px_3px_rgba(202,138,4,0.2)]"
                    : "border border-[#462E22] bg-[#1D110B] text-[#BFA98A] hover:border-[#CA8A04] hover:text-[#F5E6D3]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Contests List */}
          {loading && !data ? (
            <div className="rounded-[4px] border border-[#462E22] bg-[#1D110B] p-10 text-center font-spectral text-sm text-[#BFA98A]">
              Loading contests...
            </div>
          ) : filteredContests.length === 0 ? (
            <div className="rounded-[4px] border border-[#462E22] bg-[#1D110B] p-10 text-center font-spectral text-sm text-[#BFA98A]">
              No contests match this filter.
            </div>
          ) : (
            <div className="space-y-5">
              {filteredContests.map((contest) => {
                const sortedRounds = contest.rounds
                  .slice()
                  .sort((a, b) => a.order - b.order);
                const hasLive = sortedRounds.some(
                  (r) => getRoundStatus(r) === "ACTIVE"
                );
                const hasUpcoming = sortedRounds.some(
                  (r) => getRoundStatus(r) === "UPCOMING"
                );
                const overallStatus = hasLive
                  ? "ACTIVE"
                  : hasUpcoming
                  ? "UPCOMING"
                  : "ENDED";

                const isEnrolled =
                  isModerator ||
                  enrolledContestIds.includes(contest.id) ||
                  (currentUser
                    ? (contest.enrolledUserIds ?? []).includes(currentUser.id)
                    : false);

                return (
                  <div
                    key={contest.id}
                    className="rounded-[4px] border border-[#462E22] border-t-2 border-t-[#CA8A04] bg-[#1D110B] p-6 shadow-[0_2px_8px_rgba(202,138,4,0.2)] hover:border-[#CA8A04]/60 hover:shadow-[0_4px_16px_rgba(202,138,4,0.28)] transition-all duration-300 space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2 flex-1 min-w-[240px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill status={overallStatus} />
                          {contest.strictMode && (
                            <span className="inline-flex items-center gap-1 rounded-[2px] border border-[#581C87] bg-[#581C87]/35 px-2.5 py-1 font-cinzel text-[10px] uppercase tracking-[1px] text-[#E9D5FF]">
                              <ShieldAlert className="h-3 w-3" />
                              Strict Mode
                            </span>
                          )}
                          {isEnrolled && currentUser && (
                            <span className="inline-flex items-center gap-1 rounded-[2px] bg-[#CA8A04]/20 px-2.5 py-1 font-cinzel text-[10px] uppercase tracking-[1px] text-[#CA8A04]">
                              <CheckCircle2 className="h-3 w-3" />
                              {isModerator ? "Moderator" : "Enrolled"}
                            </span>
                          )}
                          <span className="font-spectral text-xs text-[#BFA98A]">
                            by {contest.organizerName}
                          </span>
                        </div>

                        <h3 className="font-cinzel text-xl font-semibold text-[#F5E6D3]">
                          {contest.title}
                        </h3>
                        <p className="font-spectral text-sm text-[#BFA98A] leading-[1.6]">
                          {contest.description}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {isModerator && (
                            <Link
                              href={`/moderator?contestId=${contest.id}&tab=rounds`}
                              className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#CA8A04] bg-[#2A1810] px-4 py-2 font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#CA8A04] hover:border-[#DAA520] hover:bg-[#462E22]/50 transition-all duration-300"
                            >
                              Manage Contest
                            </Link>
                          )}
                          {isEnrolled ? (
                            <Link
                              href={`/contests/${contest.id}`}
                              className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-4 py-2 font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#110A07] shadow-[0_1px_3px_rgba(202,138,4,0.2)] hover:bg-[#B8780A] transition-all duration-300"
                            >
                              Enter Contest
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          ) : currentUser ? (
                            <button
                              type="button"
                              onClick={() => {
                                setInlineJoinContestId(
                                  inlineJoinContestId === contest.id ? null : contest.id
                                );
                                setInlineCode("");
                              }}
                              className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#CA8A04] bg-transparent px-4 py-2 font-cinzel text-xs font-semibold uppercase tracking-[1px] text-[#CA8A04] hover:bg-[#CA8A04]/10 transition-all duration-300 cursor-pointer"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                              Join with Code
                            </button>
                          ) : (
                            <Link
                              href="/login"
                              className="rounded-[4px] border border-[#CA8A04] bg-transparent px-4 py-2 font-cinzel text-xs font-semibold uppercase tracking-[1px] text-[#CA8A04] hover:bg-[#CA8A04]/10 transition-all duration-300"
                            >
                              Sign In to Join
                            </Link>
                          )}
                        </div>

                        {isModerator && contest.joinCode && (
                          <div className="flex items-center gap-2 rounded-[4px] border border-[#462E22] bg-[#110A07] px-2.5 py-1 text-xs">
                            <span className="font-spectral text-[#BFA98A]">Code:</span>
                            <code className="font-fira font-semibold text-[#CA8A04]">
                              {contest.joinCode}
                            </code>
                            <button
                              type="button"
                              onClick={() => copyCode(contest.id, contest.joinCode)}
                              className="text-[#BFA98A] hover:text-[#CA8A04] cursor-pointer"
                              title="Copy joining code"
                            >
                              {copiedId === contest.id ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-[#22C55E]" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {inlineJoinContestId === contest.id && !isEnrolled && (
                      <form
                        onSubmit={(e) => handleJoinSubmit(inlineCode, e)}
                        className="flex flex-wrap items-center gap-2 rounded-[4px] border border-[#CA8A04]/40 bg-[#110A07] p-3"
                      >
                        <span className="font-spectral text-xs text-[#F5E6D3]">
                          Joining Code for {contest.title}:
                        </span>
                        <input
                          required
                          value={inlineCode}
                          onChange={(e) => setInlineCode(e.target.value.toUpperCase())}
                          placeholder="Enter code..."
                          className="w-36 rounded-[4px] border border-[#462E22] bg-[#1D110B] px-2.5 py-1.5 font-fira text-xs uppercase text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={joinBusy}
                          className="rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-3 py-1.5 font-cinzel text-xs font-bold uppercase text-[#110A07] hover:bg-[#B8780A] cursor-pointer"
                        >
                          Unlock
                        </button>
                      </form>
                    )}

                    {/* Rounds Grid */}
                    <div className="border-t border-[#2A1810] pt-3.5 space-y-2.5">
                      <div className="flex items-center gap-1.5 font-cinzel text-[11px] font-semibold uppercase tracking-[1px] text-[#BFA98A]">
                        <Layers className="h-3.5 w-3.5 text-[#CA8A04]" />
                        Rounds ({sortedRounds.length})
                      </div>
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        {sortedRounds.map((round) => {
                          const rStatus = getRoundStatus(round);
                          return (
                            <div
                              key={round.id}
                              className="flex items-center justify-between gap-2 rounded-[4px] border border-[#462E22] bg-[#110A07] px-3.5 py-2.5 hover:bg-[#2A1810]/50 transition-colors duration-300"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`rounded-[2px] px-2 py-0.5 font-cinzel text-[10px] font-semibold uppercase tracking-[1px] ${
                                      round.type === "coding"
                                        ? "border border-[#581C87] bg-[#581C87]/35 text-[#E9D5FF]"
                                        : "border border-[#462E22] bg-[#2A1810] text-[#CA8A04]"
                                    }`}
                                  >
                                    {round.type}
                                  </span>
                                  <span className="truncate font-spectral text-sm font-medium text-[#F5E6D3]">
                                    {round.title}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 font-spectral text-xs text-[#BFA98A] mt-1">
                                  <Calendar className="h-3 w-3 text-[#CA8A04]" />
                                  <span>
                                    {round.questionIds.length} Qs • {round.durationMinutes}m
                                  </span>
                                </div>
                              </div>
                              <StatusPill status={rStatus} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <aside className="lg:col-span-4 space-y-5">
          <div className="rounded-[4px] border border-[#462E22] border-t-2 border-t-[#CA8A04] bg-[#1D110B] p-6 shadow-[0_2px_8px_rgba(202,138,4,0.2)] space-y-4">
            <h3 className="font-cinzel text-xs font-semibold uppercase tracking-[1px] text-[#CA8A04]">
              Adventurer Profile
            </h3>
            {currentUser ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#DAA520] bg-[#CA8A04] font-cinzel text-base font-bold text-[#110A07] uppercase shadow-[0_0_20px_rgba(202,138,4,0.3)]">
                    {currentUser.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-cinzel text-sm font-semibold text-[#F5E6D3]">
                      {currentUser.name}
                    </div>
                    <div className="font-spectral text-xs text-[#BFA98A]">
                      @{currentUser.handle} •{" "}
                      <span className="capitalize font-medium text-[#CA8A04]">
                        {currentUser.role}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[4px] border border-[#462E22] bg-[#110A07] p-3 text-center">
                    <div className="font-cinzel text-xl font-bold text-[#F5E6D3]">
                      {isModerator ? contests.length : enrolledContestIds.length}
                    </div>
                    <div className="font-spectral text-xs text-[#BFA98A]">
                      {isModerator ? "Managed" : "Joined"}
                    </div>
                  </div>
                  <div className="rounded-[4px] border border-[#462E22] bg-[#110A07] p-3 text-center">
                    <div className="font-cinzel text-xl font-bold text-[#CA8A04]">4</div>
                    <div className="font-spectral text-xs text-[#BFA98A]">Languages</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="font-spectral text-sm text-[#BFA98A] leading-relaxed">
                  Sign in to enter contests with a joining code and submit solutions.
                </p>
                <Link
                  href="/login"
                  className="block w-full rounded-[4px] border border-[#DAA520] bg-[#CA8A04] py-2.5 text-center font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#110A07] hover:bg-[#B8780A] transition-all duration-300"
                >
                  Sign In / Create Account
                </Link>
              </div>
            )}
          </div>

          <div className="rounded-[4px] border border-[#462E22] bg-[#1D110B] p-6 shadow-[0_2px_8px_rgba(202,138,4,0.2)] space-y-3">
            <div className="flex items-center gap-2 font-cinzel text-xs font-semibold uppercase tracking-[1px] text-[#CA8A04]">
              <Terminal className="h-4 w-4" />
              Supported Languages
            </div>
            <div className="grid grid-cols-2 gap-2 font-fira text-xs">
              {["C (GCC 16)", "C++ (G++ 16)", "Java 27", "Python 3"].map((l) => (
                <div
                  key={l}
                  className="rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-2 text-[#F5E6D3]"
                >
                  {l}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
