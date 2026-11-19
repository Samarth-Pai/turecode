"use client";

import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  KeyRound,
  Lock,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { Suspense, useCallback, useEffect, useState } from "react";
import { LeaderboardPanel } from "@/components/LeaderboardPanel";
import { useUser } from "@/components/UserContext";
import { getRoundStatus, type Contest, type Question, type Round } from "@/lib/types";

interface PopulatedRound extends Round {
  questions: Question[];
}

interface ContestDetailPayload {
  contest: Omit<Contest, "rounds"> & { rounds: PopulatedRound[] };
  isEnrolled: boolean;
  questionBank: Question[];
}

function formatRemaining(targetIso: string, nowMs: number): string {
  const diff = new Date(targetIso).getTime() - nowMs;
  if (diff <= 0) return "0m 0s";
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (hrs > 24) {
    const days = Math.floor(hrs / 24);
    return `${days}d ${hrs % 24}h ${mins}m`;
  }
  return `${hrs}h ${mins}m ${secs}s`;
}

function ContestLobbyContent() {
  const params = useParams<{ contestId: string }>();
  const contestId = params.contestId;
  const { currentUser, joinContestByCode } = useUser();

  const [data, setData] = useState<ContestDetailPayload | null>(null);
  const [tab, setTab] = useState<"rounds" | "leaderboard">("rounds");
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const reloadContest = useCallback(async () => {
    const res = await fetch(`/api/contests/${contestId}`, { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, [contestId]);

  useEffect(() => {
    let active = true;
    fetch(`/api/contests/${contestId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (active && json) setData(json);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [contestId, currentUser?.id]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    setJoinBusy(true);
    try {
      const res = await joinContestByCode(joinCodeInput);
      if (!res.ok) {
        setJoinError(res.error || "Invalid joining code");
        return;
      }
      setJoinCodeInput("");
      await reloadContest();
    } finally {
      setJoinBusy(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-6xl p-10 text-center font-spectral text-sm text-[#BFA98A]">
        Loading contest...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl p-10 text-center space-y-3">
        <p className="font-cinzel text-base font-semibold text-[#F87171]">
          Contest not found.
        </p>
        <Link href="/" className="font-spectral text-sm text-[#CA8A04] underline">
          Return to Contests
        </Link>
      </div>
    );
  }

  const { contest, isEnrolled, questionBank } = data;
  const isModerator = currentUser?.role === "moderator";

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 space-y-6">
      {/* Contest Header Card */}
      <div className="rounded-[4px] border border-[#462E22] border-t-2 border-t-[#CA8A04] bg-[#1D110B] p-6 shadow-[0_4px_16px_rgba(202,138,4,0.22)] space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 font-cinzel text-[11px] uppercase tracking-[1px] text-[#BFA98A]">
              <Link href="/" className="hover:text-[#CA8A04] transition-colors">
                Contests
              </Link>
              <span>/</span>
              <span className="text-[#CA8A04]">{contest.title}</span>
              {contest.strictMode && (
                <span className="inline-flex items-center gap-1 rounded-[2px] border border-[#581C87] bg-[#581C87]/35 px-2.5 py-0.5 text-[10px] text-[#E9D5FF]">
                  <ShieldAlert className="h-3 w-3" />
                  Strict Proctoring
                </span>
              )}
            </div>
            <h1 className="font-cinzel text-2xl sm:text-3xl font-bold text-[#F5E6D3]">
              {contest.title}
            </h1>
            <p className="max-w-3xl font-spectral text-sm text-[#BFA98A] leading-[1.6]">
              {contest.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isModerator && contest.joinCode && (
              <div className="flex items-center gap-2 rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-2 text-xs">
                <span className="font-spectral text-[#BFA98A]">Join Code:</span>
                <code className="font-fira font-bold text-[#CA8A04]">
                  {contest.joinCode}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(contest.joinCode);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  }}
                  className="text-[#BFA98A] hover:text-[#CA8A04] cursor-pointer"
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-[#22C55E]" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            )}

            {isModerator && (
              <Link
                href={`/moderator?contestId=${contest.id}&tab=rounds`}
                className="rounded-[4px] border border-[#CA8A04] bg-transparent px-4 py-2 font-cinzel text-xs font-semibold uppercase tracking-[1px] text-[#CA8A04] hover:bg-[#CA8A04]/10 transition-colors duration-300"
              >
                Manage Contest
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#2A1810] pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab("rounds")}
              className={`rounded-[2px] px-3.5 py-1.5 font-cinzel text-xs font-semibold uppercase tracking-[1px] transition-all duration-300 cursor-pointer ${
                tab === "rounds"
                  ? "bg-[#CA8A04] text-[#110A07]"
                  : "border border-[#462E22] bg-[#110A07] text-[#BFA98A] hover:text-[#F5E6D3]"
              }`}
            >
              Contest Rounds ({contest.rounds.length})
            </button>

            {isModerator && (
              <button
                type="button"
                onClick={() => setTab("leaderboard")}
                className={`rounded-[2px] px-3.5 py-1.5 font-cinzel text-xs font-semibold uppercase tracking-[1px] transition-all duration-300 cursor-pointer ${
                  tab === "leaderboard"
                    ? "bg-[#CA8A04] text-[#110A07]"
                    : "border border-[#462E22] bg-[#110A07] text-[#BFA98A] hover:text-[#F5E6D3]"
                }`}
              >
                Moderator Leaderboard
              </button>
            )}
          </div>

          <div className="font-spectral text-xs text-[#BFA98A]">
            Organizer:{" "}
            <span className="font-semibold text-[#F5E6D3]">{contest.organizerName}</span>
          </div>
        </div>
      </div>

      {/* Sign In or Join Code Gate */}
      {!currentUser ? (
        <div className="rounded-[4px] border border-[#462E22] bg-[#1D110B] p-8 text-center space-y-3 shadow-[0_2px_8px_rgba(202,138,4,0.2)]">
          <h2 className="font-cinzel text-base font-bold text-[#F5E6D3]">
            Sign in required to participate
          </h2>
          <p className="font-spectral text-sm text-[#BFA98A]">
            Sign in with your participant account and enter the contest joining code to unlock rounds.
          </p>
          <Link
            href="/login"
            className="inline-block rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-5 py-2.5 font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#110A07] hover:bg-[#B8780A]"
          >
            Sign In
          </Link>
        </div>
      ) : !isEnrolled && !isModerator ? (
        <div className="rounded-[4px] border border-[#CA8A04]/40 bg-[#1D110B] p-6 space-y-4 shadow-[0_4px_16px_rgba(202,138,4,0.22)]">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[4px] border border-[#CA8A04]/40 bg-[#2A1810] text-[#CA8A04]">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-cinzel text-base font-bold text-[#F5E6D3]">
                Enter Joining Code to Unlock Contest
              </h2>
              <p className="font-spectral text-sm text-[#BFA98A]">
                Signed in as <strong className="text-[#F5E6D3]">{currentUser.name}</strong>.
                Enter the invite code for{" "}
                <strong className="text-[#F5E6D3]">{contest.title}</strong>.
              </p>
            </div>
          </div>

          <form onSubmit={handleJoin} className="flex flex-wrap items-center gap-3">
            <input
              required
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              placeholder="Enter Joining Code"
              className="w-56 h-10 rounded-[4px] border border-[#462E22] bg-[#110A07] px-3.5 py-2 font-fira text-sm font-semibold uppercase text-[#F5E6D3] hover:border-[#CA8A04] focus:border-2 focus:border-[#CA8A04] focus:outline-none"
            />
            <button
              type="submit"
              disabled={joinBusy}
              className="h-10 rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-5 font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#110A07] hover:bg-[#B8780A] disabled:opacity-35 cursor-pointer"
            >
              {joinBusy ? "Joining..." : "Unlock Contest"}
            </button>
          </form>

          {joinError && (
            <div className="rounded-[4px] border border-[#B91C1C] bg-[#991B1B]/25 px-3.5 py-2 font-spectral text-xs text-[#F87171]">
              {joinError}
            </div>
          )}
        </div>
      ) : null}

      {/* Rounds or Moderator Leaderboard */}
      {tab === "rounds" || !isModerator ? (
        <div className="space-y-4">
          {contest.rounds.length === 0 ? (
            <div className="rounded-[4px] border border-dashed border-[#462E22] bg-[#1D110B] p-10 text-center font-spectral text-sm text-[#BFA98A]">
              No rounds scheduled in this contest yet.
            </div>
          ) : (
            contest.rounds.map((round) => {
              const status = getRoundStatus(round, nowMs);
              const totalPoints = round.questions.reduce((acc, q) => acc + q.points, 0);
              const unlocked = Boolean(currentUser) && (isEnrolled || isModerator);
              const canEnter = unlocked && (status === "ACTIVE" || isModerator);

              return (
                <div
                  key={round.id}
                  className="rounded-[4px] border border-[#462E22] bg-[#1D110B] p-6 shadow-[0_2px_8px_rgba(202,138,4,0.2)] hover:border-[#CA8A04]/50 transition-all duration-300 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-[2px] px-2.5 py-0.5 font-cinzel text-[10px] font-semibold uppercase tracking-[1px] ${
                            round.type === "coding"
                              ? "border border-[#581C87] bg-[#581C87]/35 text-[#E9D5FF]"
                              : "border border-[#462E22] bg-[#2A1810] text-[#CA8A04]"
                          }`}
                        >
                          {round.type === "coding"
                            ? "Coding (C / C++ / Java / Python)"
                            : "MCQ Round"}
                        </span>
                        <span
                          className={`rounded-[2px] px-2.5 py-0.5 font-cinzel text-[10px] uppercase tracking-[1px] ${
                            status === "ACTIVE"
                              ? "bg-[#22C55E]/20 text-[#22C55E]"
                              : status === "UPCOMING"
                              ? "bg-[#CA8A04]/20 text-[#CA8A04]"
                              : "bg-[#991B1B]/25 text-[#F87171]"
                          }`}
                        >
                          {status}
                        </span>
                      </div>

                      <h2 className="font-cinzel text-xl font-semibold text-[#F5E6D3]">
                        {round.title}
                      </h2>
                      <p className="font-spectral text-sm text-[#BFA98A]">
                        {round.description}
                      </p>
                    </div>

                    <div className="text-right space-y-2 shrink-0">
                      {canEnter ? (
                        <Link
                          href={`/contests/${contest.id}/rounds/${round.id}`}
                          className={`inline-flex items-center gap-1.5 rounded-[4px] px-5 py-2.5 font-cinzel text-xs font-bold uppercase tracking-[1px] transition-all duration-300 ${
                            status === "ACTIVE"
                              ? "border border-[#DAA520] bg-[#CA8A04] text-[#110A07] shadow-[0_2px_8px_rgba(202,138,4,0.25)] hover:bg-[#B8780A]"
                              : "border border-[#CA8A04] bg-transparent text-[#CA8A04] hover:bg-[#CA8A04]/10"
                          }`}
                        >
                          {status === "ACTIVE" ? "Enter Round" : "Moderator Preview"}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#462E22] bg-[#110A07] px-5 py-2.5 font-cinzel text-xs font-semibold uppercase tracking-[1px] text-[#BFA98A] opacity-35 cursor-not-allowed"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          {!unlocked
                            ? "Join Contest to Unlock"
                            : status === "UPCOMING"
                            ? "Locked Until Start"
                            : "Round Ended"}
                        </button>
                      )}

                      <div className="flex items-center justify-end gap-1.5 font-fira text-xs text-[#BFA98A]">
                        <Clock className="h-3.5 w-3.5 text-[#CA8A04]" />
                        {status === "UPCOMING"
                          ? `Starts in ${formatRemaining(round.startTime, nowMs)}`
                          : status === "ACTIVE"
                          ? `Ends in ${formatRemaining(round.endTime, nowMs)}`
                          : `Ended ${new Date(round.endTime).toLocaleString()}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 border-t border-[#2A1810] pt-3 font-fira text-xs text-[#BFA98A]">
                    <span>{round.questions.length} Questions</span>
                    {isModerator && (
                      <>
                        <span>•</span>
                        <span>{totalPoints} Max Points</span>
                      </>
                    )}
                    <span>•</span>
                    <span>Duration: {round.durationMinutes} mins</span>
                    <span>•</span>
                    <span>
                      {new Date(round.startTime).toLocaleString()} →{" "}
                      {new Date(round.endTime).toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <LeaderboardPanel
          contestId={contest.id}
          isModerator={true}
          questions={questionBank}
        />
      )}
    </main>
  );
}

export default function ContestLobbyPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-center font-spectral text-sm text-[#BFA98A]">
          Loading Contest...
        </div>
      }
    >
      <ContestLobbyContent />
    </Suspense>
  );
}
