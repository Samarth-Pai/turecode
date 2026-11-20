"use client";

import { CheckCircle2, Copy, Layers, Plus, RefreshCw, Search, ShieldAlert, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { Suspense, useCallback, useEffect, useState } from "react";
import { LatexText } from "@/components/LatexText";
import { LeaderboardPanel } from "@/components/LeaderboardPanel";
import { McqQuestionModal } from "@/components/McqQuestionModal";
import { ModeratorSubmissionsFeed } from "@/components/ModeratorSubmissionsFeed";
import { PlatformQuestionBank } from "@/components/PlatformQuestionBank";
import { useUser } from "@/components/UserContext";
import {
  getQuestionSummary,
  getRoundStatus,
  type Contest,
  type Question,
  type Round,
} from "@/lib/types";

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function RoundEditorCard({
  contestId,
  round,
  questionBank,
  onUpdated,
  onOpenNewMcq,
  onOpenNewCoding,
}: {
  contestId: string;
  round: Round;
  questionBank: Question[];
  onUpdated: () => void;
  onOpenNewMcq: (roundId: string, sectionId?: string) => void;
  onOpenNewCoding: (roundId: string) => void;
}) {
  const [startLocal, setStartLocal] = useState(toLocalInputValue(round.startTime));
  const [endLocal, setEndLocal] = useState(toLocalInputValue(round.endTime));
  const [duration, setDuration] = useState(round.durationMinutes);
  const [codingSearchQuery, setCodingSearchQuery] = useState("");
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const status = getRoundStatus(round);
  const qMap = new Map(questionBank.map((q) => [q.id, q]));
  const assignedQuestions = round.questionIds
    .map((id) => qMap.get(id))
    .filter((q): q is Question => Boolean(q));

  const availableCodingToAdd = questionBank.filter(
    (q) => q.kind === "coding" && !round.questionIds.includes(q.id)
  );
  const matchingCodingResults = codingSearchQuery.trim()
    ? availableCodingToAdd.filter((q) => {
        const term = codingSearchQuery.trim().toLowerCase();
        return getQuestionSummary(q, 140).toLowerCase().includes(term);
      })
    : [];

  const patchRound = async (payload: Record<string, unknown>, msg?: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/contests/${contestId}/rounds/${round.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error || "Update failed");
      } else {
        if (msg) setNotice(msg);
        onUpdated();
      }
    } finally {
      setBusy(false);
    }
  };

  const deleteRound = async () => {
    setBusy(true);
    try {
      await fetch(`/api/contests/${contestId}/rounds/${round.id}`, {
        method: "DELETE",
      });
      onUpdated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[4px] border border-[#462E22] border-t-2 border-t-[#CA8A04] bg-[#1D110B] p-6 space-y-5 shadow-[0_8px_24px_rgba(0,0,0,0.45)] font-spectral text-[#F5E6D3]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#462E22] pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-[2px] border px-2 py-0.5 font-cinzel text-[10px] font-bold uppercase tracking-[1px] ${
                round.type === "coding"
                  ? "border-[#CA8A04]/50 bg-[#CA8A04]/15 text-[#CA8A04]"
                  : "border-[#581C87] bg-[#581C87]/25 text-[#F5E6D3]"
              }`}
            >
              {round.type} Round
            </span>
            <span
              className={`rounded-[2px] border px-2.5 py-0.5 font-cinzel text-[10px] font-bold uppercase tracking-[1px] ${
                status === "ACTIVE"
                  ? "border-[#22C55E]/40 bg-[#22C55E]/15 text-[#22C55E]"
                  : status === "UPCOMING"
                  ? "border-[#CA8A04]/50 bg-[#CA8A04]/15 text-[#CA8A04]"
                  : "border-[#462E22] bg-[#110A07] text-[#BFA98A]"
              }`}
            >
              {status}
            </span>
            <h3 className="font-cinzel text-lg font-bold text-[#F5E6D3]">
              {round.title}
            </h3>
          </div>
          <p className="font-spectral text-xs text-[#BFA98A]">{round.description}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/contests/${contestId}/rounds/${round.id}`}
            className="rounded-[4px] border border-[#462E22] bg-[#2A1810] px-3 py-1.5 font-cinzel text-xs font-semibold uppercase tracking-[0.5px] text-[#F5E6D3] hover:border-[#CA8A04] transition-colors duration-300"
          >
            Preview Round →
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={deleteRound}
            className="rounded-[4px] border border-[#B91C1C]/70 bg-[#991B1B]/20 px-3 py-1.5 font-cinzel text-xs font-semibold uppercase tracking-[0.5px] text-[#FCA5A5] hover:bg-[#991B1B]/35 transition-colors duration-300 cursor-pointer"
          >
            Delete Round
          </button>
        </div>
      </div>

      {/* Schedule Editor */}
      <div className="rounded-[4px] border border-[#462E22] bg-[#110A07] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#CA8A04]">
            Round Schedule & Timing
          </h4>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                patchRound({ schedulePreset: "start_now" }, "Schedule set: Live Now (24h)")
              }
              className="rounded-[2px] border border-[#22C55E]/40 bg-[#22C55E]/10 px-2.5 py-1 font-cinzel text-[10px] font-bold uppercase tracking-[0.5px] text-[#22C55E] hover:bg-[#22C55E]/20 transition-colors cursor-pointer"
            >
              Go Live Now (24h)
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                patchRound(
                  { schedulePreset: "upcoming_tomorrow" },
                  "Schedule set: Upcoming Tomorrow"
                )
              }
              className="rounded-[2px] border border-[#CA8A04]/50 bg-[#CA8A04]/15 px-2.5 py-1 font-cinzel text-[10px] font-bold uppercase tracking-[0.5px] text-[#CA8A04] hover:bg-[#CA8A04]/25 transition-colors cursor-pointer"
            >
              Schedule Tomorrow
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                patchRound({ schedulePreset: "end_now" }, "Schedule set: Ended")
              }
              className="rounded-[2px] border border-[#462E22] bg-[#1D110B] px-2.5 py-1 font-cinzel text-[10px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] hover:border-[#CA8A04] hover:text-[#F5E6D3] transition-colors cursor-pointer"
            >
              End Round Now
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4 items-end">
          <div>
            <label className="block font-cinzel text-[10px] font-semibold uppercase tracking-[0.8px] text-[#BFA98A] mb-1">
              Start Time
            </label>
            <input
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
              className="w-full rounded-[4px] border border-[#462E22] bg-[#1D110B] px-2.5 py-1.5 font-fira text-xs text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-cinzel text-[10px] font-semibold uppercase tracking-[0.8px] text-[#BFA98A] mb-1">
              End Time
            </label>
            <input
              type="datetime-local"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
              className="w-full rounded-[4px] border border-[#462E22] bg-[#1D110B] px-2.5 py-1.5 font-fira text-xs text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-cinzel text-[10px] font-semibold uppercase tracking-[0.8px] text-[#BFA98A] mb-1">
              Duration (mins)
            </label>
            <input
              type="number"
              min={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 30)}
              className="w-full rounded-[4px] border border-[#462E22] bg-[#1D110B] px-2.5 py-1.5 font-fira text-xs text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              patchRound(
                {
                  startTime: new Date(startLocal).toISOString(),
                  endTime: new Date(endLocal).toISOString(),
                  durationMinutes: duration,
                },
                "Round schedule saved."
              )
            }
            className="rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-3 py-2 font-cinzel text-xs font-bold uppercase tracking-[0.5px] text-[#110A07] hover:bg-[#B8780A] disabled:opacity-50 transition-colors duration-300 cursor-pointer"
          >
            Save Schedule
          </button>
        </div>
      </div>

      {/* Questions / Sections in Round */}
      {round.type === "mcq" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#BFA98A] flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-[#CA8A04]" />
              MCQ Sections ({round.sections?.length ?? 0}) • {assignedQuestions.length} Questions
            </h4>

            <div className="flex flex-wrap items-center gap-2">
              <input
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                placeholder="New Section Title (e.g. Section C: Math)"
                className="rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-1.5 font-spectral text-xs text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none w-56"
              />
              <button
                type="button"
                disabled={busy || !newSectionTitle.trim()}
                onClick={async () => {
                  const title = newSectionTitle.trim();
                  if (!title) return;
                  await patchRound(
                    { action: "add_section", sectionTitle: title },
                    `Added section "${title}".`
                  );
                  setNewSectionTitle("");
                }}
                className="inline-flex items-center gap-1 rounded-[4px] border border-[#CA8A04]/60 bg-[#2A1810] px-3 py-1.5 font-cinzel text-xs font-semibold uppercase tracking-[0.5px] text-[#CA8A04] hover:border-[#DAA520] disabled:opacity-40 cursor-pointer"
              >
                <Plus className="h-3 w-3" /> Add Section
              </button>
              <button
                type="button"
                onClick={() => onOpenNewMcq(round.id, round.sections?.[0]?.id)}
                className="rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-3 py-1.5 font-cinzel text-xs font-bold uppercase tracking-[0.5px] text-[#110A07] hover:bg-[#B8780A] cursor-pointer"
              >
                + Create MCQ Set
              </button>
            </div>
          </div>

          {(!round.sections || round.sections.length === 0) && assignedQuestions.length === 0 ? (
            <div className="rounded-[4px] border border-dashed border-[#462E22] p-4 text-center font-spectral text-xs text-[#BFA98A]">
              No sections created yet. Add a section above and create a set of MCQs under it.
            </div>
          ) : (
            <div className="space-y-3">
              {(round.sections && round.sections.length > 0
                ? round.sections
                : [
                    {
                      id: "default-sec",
                      title: "All Questions",
                      questionIds: round.questionIds,
                    },
                  ]
              ).map((sec) => {
                const secQuestions = sec.questionIds
                  .map((id) => qMap.get(id))
                  .filter((q): q is Question => Boolean(q));

                return (
                  <div
                    key={sec.id}
                    className="rounded-[4px] border border-[#462E22] bg-[#110A07] overflow-hidden"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#462E22] bg-[#160C08] px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-cinzel text-xs font-bold text-[#CA8A04]">
                          {sec.title}
                        </span>
                        <span className="rounded-[2px] border border-[#462E22] bg-[#110A07] px-2 py-0.5 font-fira text-[10px] text-[#BFA98A]">
                          {secQuestions.length} MCQ{secQuestions.length === 1 ? "" : "s"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onOpenNewMcq(
                              round.id,
                              sec.id === "default-sec" ? undefined : sec.id
                            )
                          }
                          className="rounded-[4px] border border-[#CA8A04]/50 bg-[#2A1810] px-2.5 py-1 font-cinzel text-[10px] font-semibold uppercase text-[#CA8A04] hover:border-[#DAA520] cursor-pointer"
                        >
                          + Add MCQ Set
                        </button>
                        {sec.id !== "default-sec" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              patchRound(
                                { action: "delete_section", sectionId: sec.id },
                                `Deleted section "${sec.title}".`
                              )
                            }
                            title="Delete section"
                            className="rounded-[4px] border border-[#B91C1C]/60 bg-[#991B1B]/15 p-1 text-[#FCA5A5] hover:bg-[#991B1B]/30 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {secQuestions.length === 0 ? (
                      <div className="p-3 text-center font-spectral text-xs text-[#BFA98A]/70">
                        No MCQs in this section yet. Click &ldquo;+ Add MCQ Set&rdquo; to create questions here.
                      </div>
                    ) : (
                      <div className="divide-y divide-[#462E22]/60">
                        {secQuestions.map((q, idx) => (
                          <div
                            key={q.id}
                            className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
                          >
                            <div className="min-w-0 flex-1 flex flex-wrap items-center gap-2.5">
                              <span className="font-fira text-xs font-bold text-[#CA8A04]">
                                Q{idx + 1}.
                              </span>
                              <span className="font-spectral text-sm text-[#F5E6D3] line-clamp-1">
                                <LatexText text={q.kind === "mcq" ? q.prompt : q.title} />
                              </span>
                              <span className="rounded-[2px] border border-[#462E22] bg-[#1D110B] px-2 py-0.5 font-cinzel text-[10px] font-semibold uppercase text-[#BFA98A]">
                                {q.difficulty}
                              </span>
                              <span className="font-fira text-xs text-[#22C55E]">
                                {q.points} pts
                              </span>
                            </div>

                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                patchRound(
                                  { action: "remove_question", questionId: q.id },
                                  "Removed MCQ from section."
                                )
                              }
                              className="rounded-[4px] border border-[#B91C1C]/70 bg-[#991B1B]/20 px-2.5 py-1 font-cinzel text-[11px] font-semibold uppercase text-[#FCA5A5] hover:bg-[#991B1B]/35 cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#BFA98A]">
              Contest Coding Problems ({assignedQuestions.length})
            </h4>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-72 sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#CA8A04]" />
                <input
                  value={codingSearchQuery}
                  onChange={(e) => setCodingSearchQuery(e.target.value)}
                  placeholder="Search coding question bank to add..."
                  className="w-full rounded-[4px] border border-[#462E22] bg-[#110A07] pl-8 pr-3 py-1.5 font-spectral text-xs text-[#F5E6D3] placeholder:text-[#BFA98A]/70 focus:border-[#CA8A04] focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => onOpenNewCoding(round.id)}
                className="rounded-[4px] border border-[#CA8A04]/60 bg-[#2A1810] px-3 py-1.5 font-cinzel text-xs font-semibold uppercase tracking-[0.5px] text-[#CA8A04] hover:border-[#DAA520] hover:bg-[#462E22]/50 transition-colors cursor-pointer"
              >
                + Create New DSL Coding Question
              </button>
            </div>
          </div>

          {/* Search Results from Coding Question Bank */}
          {codingSearchQuery.trim() && (
            <div className="rounded-[4px] border border-[#CA8A04]/50 bg-[#160C08] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-cinzel text-[10px] font-bold uppercase tracking-[0.8px] text-[#CA8A04]">
                  Question Bank Matches ({matchingCodingResults.length})
                </span>
                <button
                  type="button"
                  onClick={() => setCodingSearchQuery("")}
                  className="font-cinzel text-[10px] uppercase text-[#BFA98A] hover:text-[#F5E6D3] cursor-pointer"
                >
                  Clear Search
                </button>
              </div>

              {matchingCodingResults.length === 0 ? (
                <div className="py-2 font-spectral text-xs text-[#BFA98A]">
                  No unassigned coding questions in the bank match &ldquo;{codingSearchQuery}&rdquo;.
                </div>
              ) : (
                <div className="divide-y divide-[#462E22]/60 rounded-[4px] border border-[#462E22] bg-[#110A07]">
                  {matchingCodingResults.map((q) => (
                    <div
                      key={q.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-cinzel text-xs font-semibold text-[#F5E6D3]">
                          {getQuestionSummary(q)}
                        </span>
                        <span className="rounded-[2px] border border-[#462E22] bg-[#1D110B] px-1.5 py-0.5 font-cinzel text-[10px] uppercase text-[#BFA98A]">
                          {q.difficulty}
                        </span>
                        <span className="font-fira text-xs text-[#22C55E]">
                          {q.points} pts
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          await patchRound(
                            { action: "add_question", questionId: q.id },
                            `Added "${getQuestionSummary(q)}" to round.`
                          );
                          setCodingSearchQuery("");
                        }}
                        className="rounded-[4px] border border-[#22C55E]/40 bg-[#22C55E]/15 px-2.5 py-1 font-cinzel text-[10px] font-bold uppercase text-[#22C55E] hover:bg-[#22C55E]/25 disabled:opacity-40 cursor-pointer"
                      >
                        + Add to Round
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {assignedQuestions.length === 0 ? (
            <div className="rounded-[4px] border border-dashed border-[#462E22] p-4 text-center font-spectral text-xs text-[#BFA98A]">
              No coding questions in this round yet. Search the Question Bank above to add a question.
            </div>
          ) : (
            <div className="divide-y divide-[#462E22] rounded-[4px] border border-[#462E22] bg-[#110A07]">
              {assignedQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-fira text-xs text-[#BFA98A]">
                      Q{idx + 1}.
                    </span>
                    <span className="font-cinzel text-sm font-semibold text-[#F5E6D3]">
                      {getQuestionSummary(q)}
                    </span>
                    <span className="rounded-[2px] border border-[#462E22] bg-[#1D110B] px-2 py-0.5 font-cinzel text-[10px] font-semibold uppercase text-[#BFA98A]">
                      {q.difficulty}
                    </span>
                    <span className="font-fira text-xs text-[#22C55E]">
                      {q.points} pts
                    </span>
                    {q.kind === "coding" && q.useDslStubs && (
                      <span className="rounded-[2px] border border-[#581C87] bg-[#581C87]/25 px-1.5 py-0.5 font-fira text-[10px] text-[#F5E6D3]">
                        DSL Stubs (C/C++/Java/Py)
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      patchRound(
                        { action: "remove_question", questionId: q.id },
                        `Removed "${getQuestionSummary(q)}" from round.`
                      )
                    }
                    className="rounded-[4px] border border-[#B91C1C]/70 bg-[#991B1B]/20 px-2.5 py-1 font-cinzel text-[11px] font-semibold uppercase text-[#FCA5A5] hover:bg-[#991B1B]/35 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {notice && (
        <div className="rounded-[4px] border border-[#22C55E]/40 bg-[#22C55E]/10 px-3 py-2 font-spectral text-xs font-medium text-[#22C55E]">
          {notice}
        </div>
      )}
    </div>
  );
}

function ModeratorContent() {
  const searchParams = useSearchParams();
  const { currentUser, loading: authLoading } = useUser();

  const initialContestId = searchParams.get("contestId") || "";
  const rawUrlTab = searchParams.get("tab");
  const normalizedUrlTab: "rounds" | "bank" | "submissions" | "leaderboard" =
    rawUrlTab === "bank" || rawUrlTab === "dsl"
      ? "bank"
      : rawUrlTab === "submissions"
      ? "submissions"
      : rawUrlTab === "leaderboard"
      ? "leaderboard"
      : "rounds";

  const [tabOverride, setTabOverride] = useState<{
    forUrlTab: string | null;
    value: "rounds" | "bank" | "submissions" | "leaderboard";
  } | null>(null);

  const tab =
    tabOverride && tabOverride.forUrlTab === rawUrlTab
      ? tabOverride.value
      : normalizedUrlTab;

  const setTab = (next: "rounds" | "bank" | "submissions" | "leaderboard") => {
    setTabOverride({ forUrlTab: rawUrlTab, value: next });
  };

  const [contests, setContests] = useState<Contest[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedContestId, setSelectedContestId] = useState(initialContestId);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);

  const [showNewContest, setShowNewContest] = useState(false);
  const [newContestTitle, setNewContestTitle] = useState("");
  const [newContestDesc, setNewContestDesc] = useState("");
  const [newContestJoinCode, setNewContestJoinCode] = useState("");
  const [newContestStrict, setNewContestStrict] = useState(false);

  const [showNewRound, setShowNewRound] = useState(false);
  const [newRoundTitle, setNewRoundTitle] = useState("");
  const [newRoundDesc, setNewRoundDesc] = useState("");
  const [newRoundType, setNewRoundType] = useState<"mcq" | "coding">("coding");
  const [newRoundDuration, setNewRoundDuration] = useState(60);

  const [mcqModalTarget, setMcqModalTarget] = useState<{
    contestId?: string;
    roundId?: string;
    sectionId?: string;
  } | null>(null);
  const [dslTargetRoundId, setDslTargetRoundId] = useState<string>("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/contests", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setContests(data.contests || []);
        setQuestions(data.questions || []);
        setSelectedContestId((prev) => {
          if (prev && (data.contests || []).some((c: Contest) => c.id === prev)) {
            return prev;
          }
          return data.contests?.[0]?.id || "";
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/contests", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setContests(data.contests || []);
        setQuestions(data.questions || []);
        setSelectedContestId((prev) => {
          if (prev && (data.contests || []).some((c: Contest) => c.id === prev)) {
            return prev;
          }
          return data.contests?.[0]?.id || "";
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentUser?.id]);

  const activeContest = contests.find((c) => c.id === selectedContestId) ?? contests[0];

  const handleCreateContest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const res = await fetch("/api/contests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newContestTitle,
        description: newContestDesc,
        joinCode: newContestJoinCode,
        strictMode: newContestStrict,
        organizerId: currentUser.id,
        organizerName: currentUser.name,
        initialMcqQuestionIds: [],
        initialCodingQuestionIds: [],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setNewContestTitle("");
      setNewContestDesc("");
      setNewContestJoinCode("");
      setNewContestStrict(false);
      setShowNewContest(false);
      await loadAll();
      setSelectedContestId(data.contest.id);
    }
  };

  const handleToggleStrictMode = async () => {
    if (!activeContest) return;
    const res = await fetch(`/api/contests/${activeContest.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strictMode: !activeContest.strictMode }),
    });
    if (res.ok) {
      await loadAll();
    }
  };

  const handleRegenerateCode = async () => {
    if (!activeContest) return;
    const res = await fetch(`/api/contests/${activeContest.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "regenerate_join_code" }),
    });
    if (res.ok) {
      await loadAll();
    }
  };

  const handleCreateRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeContest) return;
    const res = await fetch(`/api/contests/${activeContest.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_round",
        roundTitle: newRoundTitle,
        roundDescription: newRoundDesc,
        type: newRoundType,
        durationMinutes: newRoundDuration,
        questionIds: [],
      }),
    });
    if (res.ok) {
      setNewRoundTitle("");
      setNewRoundDesc("");
      setShowNewRound(false);
      await loadAll();
    }
  };

  if (!authLoading && currentUser?.role !== "moderator") {
    return (
      <main className="mx-auto max-w-xl p-12 text-center font-spectral text-[#F5E6D3]">
        <div className="rounded-[4px] border border-[#462E22] border-t-2 border-t-[#CA8A04] bg-[#1D110B] p-8 space-y-4 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
          <h1 className="font-cinzel text-xl font-bold text-[#F5E6D3]">
            Moderator Access Required
          </h1>
          <p className="font-spectral text-sm text-[#BFA98A]">
            Please sign in with a Moderator account to manage contests, schedules, strict mode, DSL code stubs, and leaderboards.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              href="/login"
              className="rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-5 py-2.5 font-cinzel text-xs font-bold uppercase tracking-[0.5px] text-[#110A07]"
            >
              Sign In as Moderator
            </Link>
            <Link
              href="/"
              className="rounded-[4px] border border-[#462E22] bg-[#2A1810] px-4 py-2.5 font-cinzel text-xs font-semibold uppercase tracking-[0.5px] text-[#F5E6D3]"
            >
              Back to Contests
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 space-y-6 font-spectral text-[#F5E6D3]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#CA8A04]">
            Contest Administration
          </div>
          <h1 className="font-cinzel text-2xl font-bold text-[#F5E6D3] mt-0.5">
            Moderator Studio
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/sandbox-status"
            className="rounded-[4px] border border-[#462E22] bg-[#2A1810] px-3.5 py-2 font-cinzel text-xs font-semibold uppercase tracking-[0.5px] text-[#BFA98A] hover:border-[#CA8A04] hover:text-[#F5E6D3] transition-colors duration-300"
          >
            Sandbox Health
          </Link>
          <button
            type="button"
            onClick={() => setShowNewContest(true)}
            className="rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-4 py-2 font-cinzel text-xs font-bold uppercase tracking-[0.5px] text-[#110A07] shadow-[0_0_16px_rgba(202,138,4,0.28)] hover:bg-[#B8780A] transition-colors duration-300 cursor-pointer"
          >
            + New Contest
          </button>
        </div>
      </div>

      {/* Contest Switcher, Join Code, Strict Mode Toggle & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[4px] border border-[#462E22] border-t-2 border-t-[#CA8A04] bg-[#1D110B] px-4 py-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={activeContest?.id || ""}
            onChange={(e) => setSelectedContestId(e.target.value)}
            className="rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-1.5 font-cinzel text-sm font-semibold text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
          >
            {contests.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.rounds.length} rounds)
              </option>
            ))}
          </select>

          {activeContest?.joinCode && (
            <div className="flex items-center gap-2 rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-1.5 text-xs">
              <span className="font-cinzel text-[10px] uppercase tracking-[0.8px] text-[#BFA98A]">
                Join Code:
              </span>
              <code className="font-fira font-bold text-[#CA8A04]">
                {activeContest.joinCode}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(activeContest.joinCode);
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 1500);
                }}
                className="text-[#BFA98A] hover:text-[#CA8A04] cursor-pointer"
              >
                {copiedCode ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#22C55E]" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={handleRegenerateCode}
                className="text-[#BFA98A] hover:text-[#F5E6D3] cursor-pointer"
                title="Regenerate joining code"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {activeContest && (
            <button
              type="button"
              onClick={handleToggleStrictMode}
              className={`inline-flex items-center gap-1.5 rounded-[4px] border px-3 py-1.5 font-cinzel text-xs font-semibold uppercase tracking-[0.5px] transition-all duration-300 cursor-pointer ${
                activeContest.strictMode
                  ? "border-[#581C87] bg-[#581C87]/35 text-[#F5E6D3] shadow-[0_0_12px_rgba(88,28,135,0.35)]"
                  : "border-[#462E22] bg-[#110A07] text-[#BFA98A] hover:border-[#CA8A04]/60 hover:text-[#F5E6D3]"
              }`}
              title="Toggle Strict Mode (requires Fullscreen + blocks Tab Switching, max 7 warnings)"
            >
              <ShieldAlert className="h-3.5 w-3.5 text-[#CA8A04]" />
              Strict Mode: {activeContest.strictMode ? "ON" : "OFF"}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-[4px] border border-[#462E22] bg-[#110A07] p-1">
          {(
            [
              { id: "rounds", label: "Rounds & Schedules" },
              { id: "bank", label: "Question Bank" },
              { id: "submissions", label: "Code Submissions" },
              { id: "leaderboard", label: "Leaderboard" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-[2px] px-3 py-1.5 font-cinzel text-xs font-semibold uppercase tracking-[0.5px] transition-colors duration-300 cursor-pointer ${
                tab === item.id
                  ? "bg-[#CA8A04] text-[#110A07]"
                  : "text-[#BFA98A] hover:text-[#F5E6D3]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading && contests.length === 0 ? (
        <div className="rounded-[4px] border border-[#462E22] bg-[#1D110B] p-10 text-center font-spectral text-sm text-[#BFA98A]">
          Loading Moderator Studio...
        </div>
      ) : tab === "rounds" ? (
        activeContest ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-cinzel text-lg font-bold text-[#F5E6D3]">
                  {activeContest.title}
                </h2>
                <p className="font-spectral text-xs text-[#BFA98A]">
                  {activeContest.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewRound(true)}
                className="rounded-[4px] border border-[#CA8A04]/70 bg-[#2A1810] px-4 py-2 font-cinzel text-xs font-bold uppercase tracking-[0.5px] text-[#CA8A04] hover:border-[#DAA520] hover:bg-[#462E22]/50 transition-colors cursor-pointer"
              >
                + Add Round (MCQ / Coding)
              </button>
            </div>

            {activeContest.rounds.length === 0 ? (
              <div className="rounded-[4px] border border-dashed border-[#462E22] p-10 text-center font-spectral text-sm text-[#BFA98A]">
                No rounds in this contest yet. Click &ldquo;+ Add Round&rdquo; to create an MCQ or Coding round.
              </div>
            ) : (
              <div className="space-y-5">
                {activeContest.rounds
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((round) => (
                    <RoundEditorCard
                      key={`${round.id}-${round.startTime}-${round.endTime}-${round.durationMinutes}`}
                      contestId={activeContest.id}
                      round={round}
                      questionBank={questions}
                      onUpdated={() => {
                        loadAll();
                        setRefreshTick((t) => t + 1);
                      }}
                      onOpenNewMcq={(rId, secId) =>
                        setMcqModalTarget({
                          contestId: activeContest.id,
                          roundId: rId,
                          sectionId: secId,
                        })
                      }
                      onOpenNewCoding={(rId) => {
                        setDslTargetRoundId(rId);
                        setTab("bank");
                      }}
                    />
                  ))}
              </div>
            )}
          </div>
        ) : null
      ) : tab === "bank" ? (
        <PlatformQuestionBank
          questions={questions}
          activeContestId={activeContest?.id}
          defaultRoundId={dslTargetRoundId}
          onUpdated={() => {
            loadAll();
            setRefreshTick((t) => t + 1);
          }}
        />
      ) : tab === "submissions" ? (
        activeContest ? (
          <ModeratorSubmissionsFeed
            contest={activeContest}
            questions={questions}
          />
        ) : null
      ) : activeContest ? (
        <LeaderboardPanel
          contestId={activeContest.id}
          isModerator={true}
          questions={questions}
          refreshSignal={refreshTick}
        />
      ) : null}

      {/* New Contest Modal (with Platform Question Bank Reuse) */}
      {showNewContest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#110A07]/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-xl rounded-[6px] border border-[#462E22] border-t-2 border-t-[#CA8A04] bg-[#1D110B] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.65)] space-y-4 max-h-[88vh] overflow-y-auto">
            <h3 className="font-cinzel text-base font-bold text-[#F5E6D3]">
              Create New Contest
            </h3>
            <form onSubmit={handleCreateContest} className="space-y-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
                    Contest Title
                  </label>
                  <input
                    required
                    value={newContestTitle}
                    onChange={(e) => setNewContestTitle(e.target.value)}
                    placeholder="e.g., Winter CodeFest 2026"
                    className="w-full rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-2 text-sm text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
                    Custom Joining Code (optional)
                  </label>
                  <input
                    value={newContestJoinCode}
                    onChange={(e) => setNewContestJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g., WINTER-26"
                    className="w-full rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-2 font-fira text-sm uppercase text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newContestDesc}
                  onChange={(e) => setNewContestDesc(e.target.value)}
                  placeholder="Describe rounds and rules..."
                  className="w-full rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-2 text-sm text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2 rounded-[4px] border border-[#581C87] bg-[#110A07] p-3 text-xs text-[#F5E6D3] cursor-pointer">
                <input
                  type="checkbox"
                  checked={newContestStrict}
                  onChange={(e) => setNewContestStrict(e.target.checked)}
                  className="accent-[#CA8A04]"
                />
                <span>
                  <strong className="font-cinzel text-[#CA8A04]">
                    Enable Strict Proctoring Mode
                  </strong>{" "}
                  (Fullscreen required, max 7 tab-switch warnings)
                </span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewContest(false)}
                  className="rounded-[4px] border border-[#462E22] bg-[#2A1810] px-4 py-2 font-cinzel text-xs text-[#BFA98A] hover:border-[#CA8A04] hover:text-[#F5E6D3] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-4 py-2 font-cinzel text-xs font-bold uppercase text-[#110A07] hover:bg-[#B8780A] cursor-pointer"
                >
                  Create Contest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Round Modal (with Platform Question Bank Reuse) */}
      {showNewRound && activeContest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#110A07]/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-[6px] border border-[#462E22] border-t-2 border-t-[#CA8A04] bg-[#1D110B] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.65)] space-y-4 max-h-[85vh] overflow-y-auto">
            <h3 className="font-cinzel text-base font-bold text-[#F5E6D3]">
              Add Round to {activeContest.title}
            </h3>
            <form onSubmit={handleCreateRound} className="space-y-3">
              <div>
                <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
                  Round Type
                </label>
                <select
                  value={newRoundType}
                  onChange={(e) => {
                    setNewRoundType(e.target.value as "mcq" | "coding");
                  }}
                  className="w-full rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-2 text-sm text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
                >
                  <option value="mcq">MCQ Round (Objective Questions)</option>
                  <option value="coding">Coding Round (C / C++ / Java / Python)</option>
                </select>
              </div>
              <div>
                <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
                  Round Title
                </label>
                <input
                  required
                  value={newRoundTitle}
                  onChange={(e) => setNewRoundTitle(e.target.value)}
                  placeholder="e.g., Round 3: Graph Algorithms"
                  className="w-full rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-2 text-sm text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newRoundDesc}
                  onChange={(e) => setNewRoundDesc(e.target.value)}
                  className="w-full rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-2 text-sm text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  min={5}
                  value={newRoundDuration}
                  onChange={(e) => setNewRoundDuration(Number(e.target.value) || 60)}
                  className="w-full rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-2 font-fira text-sm text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewRound(false)}
                  className="rounded-[4px] border border-[#462E22] bg-[#2A1810] px-4 py-2 font-cinzel text-xs text-[#BFA98A] hover:border-[#CA8A04] hover:text-[#F5E6D3] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-4 py-2 font-cinzel text-xs font-bold uppercase text-[#110A07] hover:bg-[#B8780A] cursor-pointer"
                >
                  Add Round
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {mcqModalTarget && (
        <McqQuestionModal
          contestId={mcqModalTarget.contestId}
          roundId={mcqModalTarget.roundId}
          sections={
            mcqModalTarget.roundId
              ? activeContest?.rounds.find((r) => r.id === mcqModalTarget.roundId)
                  ?.sections ?? []
              : []
          }
          defaultSectionId={mcqModalTarget.sectionId}
          onClose={() => setMcqModalTarget(null)}
          onSaved={() => {
            loadAll();
            setRefreshTick((t) => t + 1);
          }}
        />
      )}
    </main>
  );
}

export default function ModeratorPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-center font-spectral text-sm text-[#BFA98A]">
          Loading Moderator Studio...
        </div>
      }
    >
      <ModeratorContent />
    </Suspense>
  );
}
