"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ChevronLeft, ChevronRight, Flag, Send } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useUser } from "@/components/UserContext";
import type { MCQQuestion, MCQSubmission, Round } from "@/lib/types";

interface McqRoundArenaProps {
  contestId: string;
  contestTitle: string;
  round: Round;
  questions: MCQQuestion[];
  scheduleStatus: "UPCOMING" | "ACTIVE" | "ENDED";
}

export function McqRoundArena({
  contestId,
  contestTitle,
  round,
  questions,
  scheduleStatus,
}: McqRoundArenaProps) {
  const { currentUser } = useUser();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submittedNotice, setSubmittedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        setAnswers(map);
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

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-4xl p-8 text-center font-spectral text-sm text-[#BFA98A]">
        No MCQ questions have been added to this round yet.
      </div>
    );
  }

  const currentQ = questions[currentIndex] ?? questions[0];
  const answeredCount = questions.filter((q) => Boolean(answers[q.id])).length;
  const canSubmit =
    Boolean(currentUser) &&
    (scheduleStatus === "ACTIVE" || currentUser?.role === "moderator");

  const handleSubmitAll = async () => {
    if (!currentUser) return;
    setError(null);
    const payloadAnswers = Object.entries(answers).map(([questionId, selectedOptionId]) => ({
      questionId,
      selectedOptionId,
    }));

    if (payloadAnswers.length === 0) {
      setError("Please answer at least one question before submitting.");
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
          moderatorOverride: currentUser.role === "moderator",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit MCQ round");
        return;
      }
      setSubmittedNotice(
        `Assessment submitted! ${payloadAnswers.length} response(s) recorded for moderator evaluation.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 space-y-5 font-spectral text-[#F5E6D3]">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[4px] border border-[#5C3D2E] border-t-2 border-t-[#CA8A04] bg-[#2C1A10] px-5 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
        <div>
          <div className="flex items-center gap-2 font-cinzel text-xs uppercase tracking-[1px] text-[#BFA98A]">
            <Link
              href={`/contests/${contestId}`}
              className="hover:text-[#F5E6D3] transition-colors duration-300"
            >
              {contestTitle}
            </Link>
            <span className="text-[#5C3D2E]">/</span>
            <span className="text-[#CA8A04] font-semibold">MCQ Trial</span>
          </div>
          <h1 className="font-cinzel text-xl font-bold text-[#F5E6D3] mt-0.5 tracking-wide">
            {round.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-[4px] border border-[#5C3D2E] bg-[#1A0F0A] px-3.5 py-2 font-fira text-xs text-[#BFA98A]">
            Answered:{" "}
            <strong className="text-[#CA8A04]">{answeredCount}</strong> /{" "}
            <span className="text-[#F5E6D3]">{questions.length}</span>
          </div>

          <button
            type="button"
            disabled={submitting || !canSubmit}
            onClick={handleSubmitAll}
            className="inline-flex items-center gap-2 rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-4 py-2 font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#1A0F0A] shadow-[0_0_16px_rgba(202,138,4,0.28)] hover:bg-[#B8780A] disabled:opacity-50 transition-all duration-300 cursor-pointer"
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
            className="rounded-[4px] border border-[#5C3D2E] bg-[#3D2517] px-4 py-2 font-cinzel text-xs font-semibold uppercase tracking-[1px] text-[#F5E6D3] hover:border-[#CA8A04] transition-all duration-300"
          >
            Back to Contest →
          </Link>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Question Palette */}
        <aside className="rounded-[4px] border border-[#5C3D2E] bg-[#2C1A10] p-5 space-y-4 h-fit shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
          <div className="font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#BFA98A]">
            Question Palette
          </div>
          <div className="grid grid-cols-5 gap-2">
            {questions.map((q, idx) => {
              const isCurrent = idx === currentIndex;
              const isAnswered = Boolean(answers[q.id]);
              const isFlagged = Boolean(flagged[q.id]);

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-9 rounded-[2px] font-fira text-xs font-bold border transition-all duration-300 cursor-pointer ${
                    isCurrent
                      ? "border-[#DAA520] bg-[#CA8A04]/25 text-[#F5E6D3] shadow-[0_0_12px_rgba(202,138,4,0.28)]"
                      : isFlagged
                      ? "border-[#CA8A04]/60 bg-[#CA8A04]/15 text-[#CA8A04]"
                      : isAnswered
                      ? "border-[#22C55E]/50 bg-[#22C55E]/15 text-[#22C55E]"
                      : "border-[#5C3D2E] bg-[#1A0F0A] text-[#BFA98A] hover:border-[#CA8A04]/60 hover:text-[#F5E6D3]"
                  }`}
                >
                  Q{idx + 1}
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5 border-t border-[#5C3D2E] pt-3 font-spectral text-xs text-[#BFA98A]">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-[#22C55E]/25 border border-[#22C55E]" />
              Answered
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-[#CA8A04]/25 border border-[#CA8A04]" />
              Flagged for Review
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-[#1A0F0A] border border-[#5C3D2E]" />
              Not Answered
            </div>
          </div>
        </aside>

        {/* Active Question */}
        <motion.section
          key={currentQ.id}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="lg:col-span-3 rounded-[4px] border border-[#5C3D2E] border-t-2 border-t-[#CA8A04] bg-[#2C1A10] p-6 space-y-6 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#5C3D2E] pb-4">
            <div className="flex items-center gap-2.5">
              <span className="rounded-[2px] border border-[#CA8A04]/50 bg-[#CA8A04]/15 px-2.5 py-1 font-cinzel text-[11px] font-bold uppercase tracking-[1px] text-[#CA8A04]">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span className="rounded-[2px] border border-[#5C3D2E] bg-[#1A0F0A] px-2.5 py-1 font-cinzel text-[11px] uppercase tracking-[1px] text-[#BFA98A]">
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

          <div className="space-y-3">
            <h2 className="font-cinzel text-xl font-bold text-[#F5E6D3]">
              {currentQ.title}
            </h2>
            <p className="font-spectral text-base leading-relaxed text-[#F5E6D3]/90 whitespace-pre-line">
              {currentQ.prompt}
            </p>
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
                      ? "border-[#CA8A04] bg-[#3D2517] text-[#F5E6D3] shadow-[0_0_16px_rgba(202,138,4,0.18)]"
                      : "border-[#5C3D2E] bg-[#1A0F0A] text-[#BFA98A] hover:border-[#CA8A04]/60 hover:bg-[#3D2517]/50 hover:text-[#F5E6D3]"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] border font-fira text-xs font-bold uppercase ${
                      selected
                        ? "border-[#DAA520] bg-[#CA8A04] text-[#1A0F0A]"
                        : "border-[#5C3D2E] bg-[#2C1A10] text-[#BFA98A]"
                    }`}
                  >
                    {opt.id}
                  </span>
                  <span>{opt.text}</span>
                </motion.button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#5C3D2E] pt-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#5C3D2E] bg-[#3D2517] px-3.5 py-2 font-cinzel text-xs font-semibold uppercase tracking-[0.5px] text-[#F5E6D3] hover:border-[#CA8A04] disabled:opacity-40 transition-all duration-300 cursor-pointer"
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
                    : "border-[#5C3D2E] bg-[#1A0F0A] text-[#BFA98A] hover:border-[#CA8A04]/60 hover:text-[#F5E6D3]"
                }`}
              >
                <Flag className="h-3.5 w-3.5" />
                {flagged[currentQ.id] ? "Flagged" : "Flag"}
              </button>
            </div>

            <button
              type="button"
              disabled={currentIndex >= questions.length - 1}
              onClick={() =>
                setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))
              }
              className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#CA8A04]/60 bg-[#3D2517] px-4 py-2 font-cinzel text-xs font-semibold uppercase tracking-[0.5px] text-[#F5E6D3] hover:border-[#DAA520] hover:bg-[#CA8A04] hover:text-[#1A0F0A] disabled:opacity-40 transition-all duration-300 cursor-pointer"
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
