"use client";

import { useParams, usePathname } from "next/navigation";
import React, { Suspense, useEffect, useState } from "react";
import { StrictModeGuard } from "@/components/StrictModeGuard";
import { useUser } from "@/components/UserContext";
import { getRoundStatus, type Contest } from "@/lib/types";

function ContestProctoringLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ contestId: string }>();
  const pathname = usePathname();
  const contestId = params.contestId;
  const { currentUser, enrolledContestIds } = useUser();

  const [contest, setContest] = useState<Contest | null>(null);
  const [serverEnrolled, setServerEnrolled] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!contestId) return;
    let active = true;

    const load = () => {
      fetch(`/api/contests/${encodeURIComponent(contestId)}`, {
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!active || !data?.contest) return;
          setContest(data.contest);
          setServerEnrolled(Boolean(data.isEnrolled));
        })
        .catch(() => undefined);
    };

    load();
    const clockTimer = setInterval(() => setNowMs(Date.now()), 1000);
    const pollTimer = setInterval(load, 5000);

    return () => {
      active = false;
      clearInterval(clockTimer);
      clearInterval(pollTimer);
    };
  }, [contestId, pathname, currentUser?.id]);

  const isModerator = currentUser?.role === "moderator";
  const isEnrolled =
    isModerator ||
    serverEnrolled ||
    (contestId ? enrolledContestIds.includes(contestId) : false) ||
    Boolean(
      currentUser &&
        contest?.enrolledUserIds?.includes(currentUser.id)
    );

  const ongoingRounds = (contest?.rounds ?? []).filter(
    (r) => getRoundStatus(r, nowMs) === "ACTIVE"
  );
  const hasOngoingRound = ongoingRounds.length > 0;

  return (
    <StrictModeGuard
      contestId={contestId}
      contestTitle={contest?.title || "Contest"}
      hasOngoingRound={hasOngoingRound}
      ongoingRoundTitles={ongoingRounds.map((r) => r.title)}
      isModerator={isModerator}
      isEnrolled={isEnrolled}
      userId={currentUser?.id}
    >
      {children}
    </StrictModeGuard>
  );
}

export default function ContestProctoringLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<>{children}</>}>
      <ContestProctoringLayoutInner>{children}</ContestProctoringLayoutInner>
    </Suspense>
  );
}
