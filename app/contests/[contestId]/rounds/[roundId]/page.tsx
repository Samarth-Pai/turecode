"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import React, { Suspense, useEffect, useState } from "react";
import { CodingRoundArena } from "@/components/CodingRoundArena";
import { McqRoundArena } from "@/components/McqRoundArena";
import { StrictModeGuard } from "@/components/StrictModeGuard";
import { useUser } from "@/components/UserContext";
import type {
  CodingQuestion,
  MCQQuestion,
  Question,
  Round,
  RoundScheduleStatus,
} from "@/lib/types";

interface RoundPayload {
  contest: {
    id: string;
    title: string;
    organizerName: string;
    strictMode?: boolean;
  };
  round: Round;
  scheduleStatus: RoundScheduleStatus;
  questions: Question[];
}

function RoundArenaContent() {
  const params = useParams<{ contestId: string; roundId: string }>();
  const contestId = params.contestId;
  const roundId = params.roundId;
  const { currentUser, enrolledContestIds, loading: authLoading } = useUser();

  const [data, setData] = useState<RoundPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/contests/${contestId}/rounds/${roundId}`, { cache: "no-store" })
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
  }, [contestId, roundId]);

  if ((loading || authLoading) && !data) {
    return (
      <div className="p-10 text-center font-spectral text-sm text-[#BFA98A]">
        Loading Round Arena...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-10 text-center space-y-3">
        <p className="font-cinzel text-base font-semibold text-[#F87171]">
          Round not found.
        </p>
        <Link href={`/contests/${contestId}`} className="font-spectral text-sm text-[#CA8A04] underline">
          Return to Contest
        </Link>
      </div>
    );
  }

  const { contest, round, scheduleStatus, questions } = data;
  const isModerator = currentUser?.role === "moderator";
  const isEnrolled = isModerator || enrolledContestIds.includes(contestId);

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-lg p-12 text-center">
        <div className="rounded-[4px] border border-[#5C3D2E] border-t-2 border-t-[#CA8A04] bg-[#2C1A10] p-8 space-y-3 shadow-[0_4px_16px_rgba(202,138,4,0.22)]">
          <h1 className="font-cinzel text-lg font-bold text-[#F5E6D3]">Sign In Required</h1>
          <p className="font-spectral text-sm text-[#BFA98A]">
            Please sign in and join <strong className="text-[#F5E6D3]">{contest.title}</strong> with its joining code to access this round.
          </p>
          <Link
            href="/login"
            className="inline-block rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-5 py-2.5 font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#1A0F0A]"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (!isEnrolled) {
    return (
      <div className="mx-auto max-w-lg p-12 text-center">
        <div className="rounded-[4px] border border-[#5C3D2E] border-t-2 border-t-[#CA8A04] bg-[#2C1A10] p-8 space-y-3 shadow-[0_4px_16px_rgba(202,138,4,0.22)]">
          <h1 className="font-cinzel text-lg font-bold text-[#F5E6D3]">
            Joining Code Required
          </h1>
          <p className="font-spectral text-sm text-[#BFA98A]">
            Please enter the joining code for{" "}
            <strong className="text-[#F5E6D3]">{contest.title}</strong> before opening this round.
          </p>
          <Link
            href={`/contests/${contestId}`}
            className="inline-block rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-5 py-2.5 font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#1A0F0A]"
          >
            Go to Contest Page to Join
          </Link>
        </div>
      </div>
    );
  }

  if (scheduleStatus === "UPCOMING" && !isModerator) {
    return (
      <div className="mx-auto max-w-xl p-12 text-center">
        <div className="rounded-[4px] border border-[#5C3D2E] border-t-2 border-t-[#CA8A04] bg-[#2C1A10] p-8 space-y-3 shadow-[0_4px_16px_rgba(202,138,4,0.22)]">
          <span className="inline-block rounded-[2px] bg-[#CA8A04]/20 px-3 py-1 font-cinzel text-[11px] uppercase tracking-[1px] text-[#CA8A04]">
            Round Scheduled — Not Started Yet
          </span>
          <h1 className="font-cinzel text-xl font-bold text-[#F5E6D3]">{round.title}</h1>
          <p className="font-spectral text-sm text-[#BFA98A]">
            This round opens at{" "}
            <span className="font-fira font-semibold text-[#F5E6D3]">
              {new Date(round.startTime).toLocaleString()}
            </span>
            .
          </p>
          <Link
            href={`/contests/${contestId}`}
            className="inline-block rounded-[4px] border border-[#CA8A04] bg-transparent px-4 py-2 font-cinzel text-xs font-semibold uppercase tracking-[1px] text-[#CA8A04] hover:bg-[#CA8A04]/10"
          >
            ← Back to Contest
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        round.type === "coding"
          ? "flex flex-col overflow-hidden lg:h-[calc(100dvh-4rem)]"
          : "flex flex-1 flex-col"
      }
    >
      <StrictModeGuard
        contestId={contest.id}
        contestTitle={contest.title}
        enabled={Boolean(contest.strictMode)}
        isModerator={isModerator}
        userId={currentUser.id}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {scheduleStatus !== "ACTIVE" && isModerator && (
            <div className="border-b border-[#CA8A04]/30 bg-[#3D2517] px-4 py-2 text-center font-spectral text-xs text-[#CA8A04]">
              Moderator Preview Mode — This round is currently <strong>{scheduleStatus}</strong>{" "}
              ({new Date(round.startTime).toLocaleString()} →{" "}
              {new Date(round.endTime).toLocaleString()}).
            </div>
          )}

          {round.type === "mcq" ? (
            <McqRoundArena
              contestId={contest.id}
              contestTitle={contest.title}
              round={round}
              questions={questions.filter((q): q is MCQQuestion => q.kind === "mcq")}
              scheduleStatus={scheduleStatus}
            />
          ) : (
            <CodingRoundArena
              contestId={contest.id}
              contestTitle={contest.title}
              round={round}
              questions={questions.filter((q): q is CodingQuestion => q.kind === "coding")}
              scheduleStatus={scheduleStatus}
            />
          )}
        </div>
      </StrictModeGuard>
    </div>
  );
}

export default function RoundArenaPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-center font-spectral text-sm text-[#BFA98A]">
          Initializing Round Arena...
        </div>
      }
    >
      <RoundArenaContent />
    </Suspense>
  );
}
