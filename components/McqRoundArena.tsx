"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, Flag, Layers, Send } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LatexText } from "@/components/LatexText";
import { useUser } from "@/components/UserContext";
import { formatCountdown, useSyncedNow } from "@/lib/server-clock";
import type { MCQQuestion, MCQSubmission, McqSection, Round } from "@/lib/types";

interface McqRoundArenaProps {
  contestId: string;
  contestTitle: string;
  round: Round;
  questions: MCQQuestion[];
  scheduleStatus: "UPCOMING" | "ACTIVE" | "ENDED";
  serverOffsetMs?: number;
}

interface IndexedMcqItem {
  question: MCQQuestion;
  globalIdx: number;
  sectionId: string;
  sectionTitle: string;
}

export function McqRoundArena({
  contestId,
  contestTitle,
  round,
  questions,
  scheduleStatus,
  serverOffsetMs = 0,
}: McqRoundArenaProps) {
  const { currentUser } = useUser();
  const nowMs = useSyncedNow(serverOffsetMs);
  const endTimeMs = useMemo(() => new Date(round.endTime).getTime(), [round.endTime]);
  const remainingMs = nowMs > 0 ? Math.max(0, endTimeMs - nowMs) : null;
  const autoSubmittedRef = useRef(false);
  const answersStorageKey = `turecode_mcq_answers_${contestId}_${round.id}`;
  const flaggedStorageKey = `turecode_mcq_flagged_${contestId}_${round.id}`;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(answersStorageKey);
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });
  const [flagged, setFlagged] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(flaggedStorageKey);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });
  const [submitting, setSubmitting] = useState(false);
  const [submittedNotice, setSubmittedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(answersStorageKey, JSON.stringify(answers));
    } catch {
      // ignore
    }
  }, [answers, answersStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(flaggedStorageKey, JSON.stringify(flagged));
    } catch {
      // ignore
    }
  }, [flagged, flaggedStorageKey]);

  // Track exact per-question view time for solve-time evaluation
  const questionStartMsRef = useRef<Record<string, number>>({});
  const accumulatedSecRef = useRef<Record<string, number>>({});
  const lastActiveQIdRef = useRef<string | null>(null);
  const lastEnterMsRef = useRef<number>(0);

  const { sectionGroups, orderedItems } = useMemo(() => {
    const qMap = new Map(questions.map((q) => [q.id, q]));
    const sections: McqSection[] =
      round.sections && round.sections.length > 0
        ? round.sections
        : [
            {
              id: "default-section",
              title: "Assessment Questions",
              questionIds: questions.map((q) => q.id),
            },
          ];

    const groups: {
      section: McqSection;
      items: IndexedMcqItem[];
    }[] = [];
    const flat: IndexedMcqItem[] = [];
    const seen = new Set<string>();

    for (const sec of sections) {
      const items: IndexedMcqItem[] = [];
      for (const qId of sec.questionIds) {
        const q = qMap.get(qId);
        if (!q || seen.has(q.id)) continue;
        seen.add(q.id);
        const item: IndexedMcqItem = {
          question: q,
          globalIdx: flat.length,
          sectionId: sec.id,
          sectionTitle: sec.title,
        };
        items.push(item);
        flat.push(item);
      }
      if (items.length > 0) {
        groups.push({ section: sec, items });
      }
    }

    // Fallback for any questions in round not mapped to a section
    const ungrouped: IndexedMcqItem[] = [];
    for (const q of questions) {
      if (seen.has(q.id)) continue;
      seen.add(q.id);
      const item: IndexedMcqItem = {
        question: q,
        globalIdx: flat.length,
        sectionId: "extra-section",
        sectionTitle: q.sectionName || "General Section",
      };
      ungrouped.push(item);
      flat.push(item);
    }
    if (ungrouped.length > 0) {
      groups.push({
        section: {
          id: "extra-section",
          title: "General Section",
          questionIds: ungrouped.map((u) => u.question.id),
        },
        items: ungrouped,
      });
    }

    return { sectionGroups: groups, orderedItems: flat };
  }, [questions, round.sections]);

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    fetch(
      `/api/submissions/mcq?contestId=${encodeURIComponent(
        contestId
      )}&roundId=${encodeURIComponent(round.id)}&userId=${encodeURIComponent(
        currentUser.id
      )}`,
      { cache: "no-store" }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data?.submissions) return;
        const subs = data.submissions as MCQSubmission[];
        const map: Record<string, string> = {};
        for (const s of subs) {
          map[s.questionId] = s.selectedOptionId;
        }
        // Preserve any locally selected options while backfilling server submissions
        setAnswers((prev) => ({ ...map, ...prev }));
        if (subs.length > 0) {
          setSubmittedNotice(
            `Responses recorded (${subs.length} question${subs.length > 1 ? "s" : ""} submitted).`
          );
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [contestId, round.id, currentUser]);

  const currentItem = orderedItems[currentIndex] ?? orderedItems[0];
  const currentQId = currentItem?.question.id ?? null;

  // Track active question timer locally + notify server attempt start
  useEffect(() => {
    if (!currentQId || !currentUser) return;
    const now = Date.now();

    if (lastActiveQIdRef.current && lastActiveQIdRef.current !== currentQId) {
      const prevId = lastActiveQIdRef.current;
      const elapsedSec = Math.max(0, (now - lastEnterMsRef.current) / 1000);
      accumulatedSecRef.current[prevId] =
        (accumulatedSecRef.current[prevId] ?? 0) + elapsedSec;
    }

    lastActiveQIdRef.current = currentQId;
    lastEnterMsRef.current = now;
    if (!questionStartMsRef.current[currentQId]) {
      questionStartMsRef.current[currentQId] = now;
      fetch("/api/attempts/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contestId,
          roundId: round.id,
          questionId: currentQId,
          userId: currentUser.id,
        }),
      }).catch(() => undefined);
    }
  }, [contestId, round.id, currentQId, currentUser]);

  const submitAssessment = useCallback(
    async ({ isAuto = false }: { isAuto?: boolean } = {}) => {
      if (!currentUser) return;
      setError(null);

      const now = Date.now();
      if (lastActiveQIdRef.current) {
        const prevId = lastActiveQIdRef.current;
        accumulatedSecRef.current[prevId] =
          (accumulatedSecRef.current[prevId] ?? 0) +
          Math.max(0, (now - lastEnterMsRef.current) / 1000);
        lastEnterMsRef.current = now;
      }

      const payloadAnswers = Object.entries(answers).map(
        ([questionId, selectedOptionId]) => ({
          questionId,
          selectedOptionId,
          timeTakenSeconds: Math.max(
            1,
            Math.round(accumulatedSecRef.current[questionId] ?? 0)
          ),
        })
      );

      if (payloadAnswers.length === 0) {
        if (isAuto) {
          setSubmittedNotice(
            "Time is up! Round has ended (no MCQ responses were attempted)."
          );
        } else {
          setError("Please answer at least one question before submitting.");
        }
        return;
      }

      setSubmitting(true);
      try {
        const res = await fetch("/api/submissions/mcq", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contestId,
            roundId: round.id,
            userId: currentUser.id,
            answers: payloadAnswers,
            autoSubmit: isAuto,
            moderatorOverride: currentUser.role === "moderator",
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to submit MCQ round");
          return;
        }
        setSubmittedNotice(
          isAuto
            ? `Time is up! Your ${payloadAnswers.length} attempted MCQ response(s) were automatically submitted.`
            : `Assessment submitted! ${payloadAnswers.length} response(s) recorded for moderator evaluation.`
        );
      } finally {
        setSubmitting(false);
      }
    },
    [answers, contestId, currentUser, round.id]
  );

  const handleSubmitAll = () => submitAssessment({ isAuto: false });

  useEffect(() => {
    if (
      scheduleStatus !== "ACTIVE" ||
      remainingMs === null ||
      remainingMs > 0 ||
      autoSubmittedRef.current ||
      !currentUser ||
      currentUser.role === "moderator" ||
      submittedNotice
    ) {
      return;
    }

    autoSubmittedRef.current = true;
    const timer = setTimeout(() => {
      void submitAssessment({ isAuto: true });
    }, 0);
    return () => clearTimeout(timer);
  }, [scheduleStatus, remainingMs, currentUser, submittedNotice, submitAssessment]);

  if (orderedItems.length === 0 || !currentItem) {
    return (
      <div className="mx-auto max-w-4xl p-8 text-center font-spectral text-sm text-[#BFA98A]">
        No MCQ questions have been added to this round yet.
      </div>
    );
  }

  const currentQ = currentItem.question;
  const answeredCount = orderedItems.filter((it) => Boolean(answers[it.question.id])).length;
  const canSubmit =
    Boolean(currentUser) &&
    (scheduleStatus === "ACTIVE" || currentUser?.role === "moderator") &&
    (remainingMs === null || remainingMs > 0 || currentUser?.role === "moderator");

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 space-y-5 font-spectral text-[#F5E6D3]">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[4px] border border-[#462E22] border-t-2 border-t-[#CA8A04] bg-[#1D110B] px-5 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
        <div>
          <div className="flex items-center gap-2 font-cinzel text-xs uppercase tracking-[1px] text-[#BFA98A]">
            <Link
              href={`/contests/${contestId}`}
              className="hover:text-[#F5E6D3] transition-colors duration-300"
            >
              {contestTitle}
            </Link>
            <span className="text-[#462E22]">/</span>
            <span className="text-[#CA8A04] font-semibold">MCQ Trial</span>
          </div>
          <h1 className="font-cinzel text-xl font-bold text-[#F5E6D3] mt-0.5 tracking-wide">
            {round.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {remainingMs !== null && (
            <div
              className={`inline-flex items-center gap-1.5 rounded-[4px] border px-3.5 py-2 font-fira text-xs font-bold ${
                remainingMs <= 0
                  ? "border-[#B91C1C] bg-[#991B1B]/25 text-[#FCA5A5]"
                  : remainingMs <= 60_000
                  ? "border-[#B91C1C] bg-[#991B1B]/20 text-[#F87171] animate-pulse"
                  : remainingMs <= 300_000
                  ? "border-[#CA8A04] bg-[#CA8A04]/15 text-[#CA8A04]"
                  : "border-[#462E22] bg-[#110A07] text-[#F5E6D3]"
              }`}
              title="Time remaining in this round"
            >
              <Clock className="h-3.5 w-3.5 text-[#CA8A04]" />
              {remainingMs <= 0 ? "Ended" : formatCountdown(remainingMs)}
            </div>
          )}

          <div className="rounded-[4px] border border-[#462E22] bg-[#110A07] px-3.5 py-2 font-fira text-xs text-[#BFA98A]">
            Answered:{" "}
            <strong className="text-[#CA8A04]">{answeredCount}</strong> /{" "}
            <span className="text-[#F5E6D3]">{orderedItems.length}</span>
          </div>

          <button
            type="button"
            disabled={submitting || !canSubmit}
            onClick={handleSubmitAll}
            className="inline-flex items-center gap-2 rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-4 py-2 font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#110A07] shadow-[0_0_16px_rgba(202,138,4,0.28)] hover:bg-[#B8780A] disabled:opacity-50 transition-all duration-300 cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
            {submitting ? "Submitting..." : "Submit Assessment"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-[4px] border border-[#B91C1C] bg-[#991B1B]/20 px-4 py-3 font-spectral text-sm text-[#FCA5A5]">
          {error}
        </div>
      )}

      {submittedNotice && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[4px] border border-[#22C55E]/40 bg-[#22C55E]/10 p-4 flex flex-wrap items-center justify-between gap-4 shadow-[0_0_16px_rgba(34,197,94,0.12)]"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-[#22C55E] shrink-0" />
            <div>
              <div className="font-cinzel text-sm font-bold text-[#22C55E]">
                Submission Recorded
              </div>
              <div className="font-spectral text-xs text-[#F5E6D3]">{submittedNotice}</div>
            </div>
          </div>
          <Link
            href={`/contests/${contestId}`}
            className="rounded-[4px] border border-[#462E22] bg-[#2A1810] px-4 py-2 font-cinzel text-xs font-semibold uppercase tracking-[1px] text-[#F5E6D3] hover:border-[#CA8A04] transition-all duration-300"
          >
            Back to Contest →
          </Link>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Left Sidebar: Section & Question Palette */}
        <aside className="rounded-[4px] border border-[#462E22] bg-[#1D110B] p-5 space-y-5 h-fit shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between border-b border-[#462E22] pb-2.5">
            <span className="inline-flex items-center gap-1.5 font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#CA8A04]">
              <Layers className="h-3.5 w-3.5" />
              Sections & Palette
            </span>
            <span className="font-fira text-[11px] text-[#BFA98A]">
              {sectionGroups.length} sec
            </span>
          </div>

          <div className="space-y-4">
            {sectionGroups.map((group) => {
              const isCurrentSec = group.section.id === currentItem.sectionId;
              const secAnswered = group.items.filter((it) =>
                Boolean(answers[it.question.id])
              ).length;

              return (
                <div
                  key={group.section.id}
                  className={`rounded-[4px] border p-3 space-y-2.5 transition-colors ${
                    isCurrentSec
                      ? "border-[#CA8A04]/60 bg-[#2A1810]/60"
                      : "border-[#462E22] bg-[#110A07]/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setCurrentIndex(group.items[0].globalIdx)}
                    className="flex w-full items-center justify-between gap-2 text-left cursor-pointer"
                  >
                    <span
                      className={`font-cinzel text-[11px] font-bold leading-snug ${
                        isCurrentSec ? "text-[#CA8A04]" : "text-[#F5E6D3]"
                      }`}
                    >
                      {group.section.title}
                    </span>
                    <span className="shrink-0 rounded-[2px] border border-[#462E22] bg-[#110A07] px-1.5 py-0.5 font-fira text-[10px] text-[#BFA98A]">
                      {secAnswered}/{group.items.length}
                    </span>
                  </button>

                  <div className="grid grid-cols-5 gap-1.5">
                    {group.items.map((item) => {
                      const isCurrent = item.globalIdx === currentIndex;
                      const isAnswered = Boolean(answers[item.question.id]);
                      const isFlagged = Boolean(flagged[item.question.id]);

                      return (
                        <button
                          key={item.question.id}
                          type="button"
                          onClick={() => setCurrentIndex(item.globalIdx)}
                          className={`h-8 rounded-[2px] font-fira text-xs font-bold border transition-all duration-200 cursor-pointer ${
                            isCurrent
                              ? "border-[#DAA520] bg-[#CA8A04] text-[#110A07] shadow-[0_0_10px_rgba(202,138,4,0.3)]"
                              : isFlagged
                              ? "border-[#CA8A04]/60 bg-[#CA8A04]/15 text-[#CA8A04]"
                              : isAnswered
                              ? "border-[#22C55E]/50 bg-[#22C55E]/15 text-[#22C55E]"
                              : "border-[#462E22] bg-[#110A07] text-[#BFA98A] hover:border-[#CA8A04]/60 hover:text-[#F5E6D3]"
                          }`}
                        >
                          Q{item.globalIdx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-1.5 border-t border-[#462E22] pt-3 font-spectral text-xs text-[#BFA98A]">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-[#22C55E]/25 border border-[#22C55E]" />
              Answered
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-[#CA8A04]/25 border border-[#CA8A04]" />
              Flagged for Review
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-[#110A07] border border-[#462E22]" />
              Not Answered
            </div>
          </div>
        </aside>

        {/* Active Question (No Question Title or Topics — Section + LaTeX Prompt) */}
        <motion.section
          key={currentQ.id}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="lg:col-span-3 rounded-[4px] border border-[#462E22] border-t-2 border-t-[#CA8A04] bg-[#1D110B] p-6 space-y-6 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#462E22] pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-[2px] border border-[#CA8A04]/50 bg-[#CA8A04]/15 px-2.5 py-1 font-cinzel text-[11px] font-bold uppercase tracking-[1px] text-[#CA8A04]">
                Question {currentIndex + 1} of {orderedItems.length}
              </span>
              <span className="rounded-[2px] border border-[#462E22] bg-[#160C08] px-2.5 py-1 font-cinzel text-[11px] font-semibold text-[#F5E6D3]">
                {currentItem.sectionTitle}
              </span>
              <span className="rounded-[2px] border border-[#462E22] bg-[#110A07] px-2.5 py-1 font-cinzel text-[11px] uppercase tracking-[1px] text-[#BFA98A]">
                {currentQ.difficulty}
              </span>
            </div>

            <div className="flex items-center gap-2 font-fira text-xs">
              <span className="text-[#22C55E] font-semibold">+{currentQ.points} pts</span>
              {currentQ.negativePoints > 0 && (
                <span className="text-[#F87171]">(-{currentQ.negativePoints} wrong)</span>
              )}
            </div>
          </div>

          <div className="font-spectral text-base leading-[1.75] text-[#F5E6D3] whitespace-pre-line">
            <LatexText text={currentQ.prompt} />
          </div>

          <div className="space-y-2.5">
            {currentQ.options.map((opt) => {
              const selected = answers[currentQ.id] === opt.id;
              return (
                <motion.button
                  key={opt.id}
                  type="button"
                  whileTap={{ scale: 0.99 }}
                  onClick={() =>
                    setAnswers((prev) => ({ ...prev, [currentQ.id]: opt.id }))
                  }
                  className={`flex w-full items-center gap-3.5 rounded-[4px] border px-4 py-3.5 text-left font-spectral text-sm transition-all duration-300 cursor-pointer ${
                    selected
                      ? "border-[#CA8A04] bg-[#2A1810] text-[#F5E6D3] shadow-[0_0_16px_rgba(202,138,4,0.18)]"
                      : "border-[#462E22] bg-[#110A07] text-[#BFA98A] hover:border-[#CA8A04]/60 hover:bg-[#2A1810]/50 hover:text-[#F5E6D3]"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] border font-fira text-xs font-bold uppercase ${
                      selected
                        ? "border-[#DAA520] bg-[#CA8A04] text-[#110A07]"
                        : "border-[#462E22] bg-[#1D110B] text-[#BFA98A]"
                    }`}
                  >
                    {opt.id}
                  </span>
                  <span className="flex-1">
                    <LatexText text={opt.text} />
                  </span>
                </motion.button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#462E22] pt-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#462E22] bg-[#2A1810] px-3.5 py-2 font-cinzel text-xs font-semibold uppercase tracking-[0.5px] text-[#F5E6D3] hover:border-[#CA8A04] disabled:opacity-40 transition-all duration-300 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <button
                type="button"
                onClick={() =>
                  setFlagged((prev) => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }))
                }
                className={`inline-flex items-center gap-1.5 rounded-[4px] border px-3.5 py-2 font-cinzel text-xs font-semibold uppercase tracking-[0.5px] transition-all duration-300 cursor-pointer ${
                  flagged[currentQ.id]
                    ? "border-[#CA8A04] bg-[#CA8A04]/20 text-[#CA8A04]"
                    : "border-[#462E22] bg-[#110A07] text-[#BFA98A] hover:border-[#CA8A04]/60 hover:text-[#F5E6D3]"
                }`}
              >
                <Flag className="h-3.5 w-3.5" />
                {flagged[currentQ.id] ? "Flagged" : "Flag"}
              </button>
            </div>

            <button
              type="button"
              disabled={currentIndex >= orderedItems.length - 1}
              onClick={() =>
                setCurrentIndex((i) => Math.min(orderedItems.length - 1, i + 1))
              }
              className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#CA8A04]/60 bg-[#2A1810] px-4 py-2 font-cinzel text-xs font-semibold uppercase tracking-[0.5px] text-[#F5E6D3] hover:border-[#DAA520] hover:bg-[#CA8A04] hover:text-[#110A07] disabled:opacity-40 transition-all duration-300 cursor-pointer"
            >
              Next Question
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
