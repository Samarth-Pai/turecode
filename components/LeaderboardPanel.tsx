"use client";

import React, { useCallback, useEffect, useState } from "react";
import type {
  CodingSubmission,
  LeaderboardEntry,
  MCQSubmission,
  Question,
  Round,
} from "@/lib/types";

interface ModeratorLeaderboardRow extends LeaderboardEntry {
  violations?: number;
  lastViolationReason?: string;
}

interface LeaderboardApiResponse {
  contestId: string;
  contestTitle: string;
  strictMode?: boolean;
  roundId: string | null;
  rounds: Round[];
  maxPossibleScore: number;
  leaderboard: ModeratorLeaderboardRow[];
  mcqSubmissions: MCQSubmission[];
  codingSubmissions: CodingSubmission[];
}

interface LeaderboardPanelProps {
  contestId: string;
  isModerator: boolean;
  questions?: Question[];
  refreshSignal?: number;
}

export function LeaderboardPanel({
  contestId,
  isModerator,
  questions = [],
  refreshSignal = 0,
}: LeaderboardPanelProps) {
  const [selectedRoundId, setSelectedRoundId] = useState<string>("all");
  const [data, setData] = useState<LeaderboardApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [inspectUserId, setInspectUserId] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    if (!isModerator) return;
    setLoading(true);
    try {
      const qs =
        selectedRoundId !== "all" ? `?roundId=${encodeURIComponent(selectedRoundId)}` : "";
      const res = await fetch(`/api/contests/${contestId}/leaderboard${qs}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = (await res.json()) as LeaderboardApiResponse;
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [contestId, selectedRoundId, isModerator]);

  useEffect(() => {
    if (!isModerator) return;
    let active = true;
    const qs =
      selectedRoundId !== "all" ? `?roundId=${encodeURIComponent(selectedRoundId)}` : "";
    fetch(`/api/contests/${contestId}/leaderboard${qs}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: LeaderboardApiResponse | null) => {
        if (active && json) setData(json);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [contestId, selectedRoundId, refreshSignal, isModerator]);

  if (!isModerator) {
    return null;
  }

  const exportCsv = () => {
    if (!data) return;
    const roundCols =
      selectedRoundId === "all"
        ? data.rounds
        : data.rounds.filter((r) => r.id === selectedRoundId);
    const headers = [
      "Rank",
      "Name",
      "Handle",
      ...roundCols.map((r) => r.title),
      "Total Score",
      "Max Score",
      "Solved",
      "Attempted",
      "Violations",
      "Exec Time (ms)",
    ];
    const rows = data.leaderboard.map((e) => [
      e.rank,
      `"${e.userName}"`,
      e.userHandle,
      ...roundCols.map((r) => e.roundScores[r.id] ?? 0),
      e.totalScore,
      e.maxPossibleScore,
      e.problemsSolved,
      e.problemsAttempted,
      e.violations ?? 0,
      e.totalExecutionTimeMs,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${contestId}-leaderboard.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const qTitleMap = new Map(questions.map((q) => [q.id, q.title]));
  const rounds = data?.rounds ?? [];
  const visibleRounds =
    selectedRoundId === "all" ? rounds : rounds.filter((r) => r.id === selectedRoundId);

  const inspectedEntry = data?.leaderboard.find((e) => e.userId === inspectUserId);
  const inspectedCoding =
    data?.codingSubmissions.filter((s) => s.userId === inspectUserId) ?? [];
  const inspectedMcq =
    data?.mcqSubmissions.filter((s) => s.userId === inspectUserId) ?? [];

  return (
    <div className="rounded-[4px] border border-[#462E22] border-t-2 border-t-[#CA8A04] bg-[#1D110B] shadow-[0_8px_24px_rgba(0,0,0,0.45)] overflow-hidden font-spectral text-[#F5E6D3]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#462E22] bg-[#110A07]/50 px-5 py-4">
        <div>
          <h3 className="font-cinzel text-base font-bold text-[#F5E6D3] flex items-center gap-2">
            <span className="text-[#CA8A04]">★</span>
            Moderator Contest Leaderboard
          </h3>
          <p className="font-spectral text-xs text-[#BFA98A] mt-0.5">
            {data
              ? `${data.leaderboard.length} participants • Max Score: ${data.maxPossibleScore} pts (Hidden from participants)`
              : "Loading rankings..."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedRoundId}
            onChange={(e) => setSelectedRoundId(e.target.value)}
            className="rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-1.5 font-spectral text-xs font-medium text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
          >
            <option value="all">Overall Contest (All Rounds)</option>
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title} ({r.type.toUpperCase()})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={loadLeaderboard}
            className="rounded-[4px] border border-[#462E22] bg-[#2A1810] px-3 py-1.5 font-cinzel text-xs font-semibold uppercase tracking-[0.5px] text-[#F5E6D3] hover:border-[#CA8A04] transition-colors duration-300 cursor-pointer"
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={exportCsv}
            className="rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-3.5 py-1.5 font-cinzel text-xs font-bold uppercase tracking-[0.5px] text-[#110A07] hover:bg-[#B8780A] transition-colors duration-300 cursor-pointer"
          >
            Export CSV
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="p-8 text-center font-spectral text-sm text-[#BFA98A]">
          Loading leaderboard...
        </div>
      ) : !data || data.leaderboard.length === 0 ? (
        <div className="p-8 text-center font-spectral text-sm text-[#BFA98A]">
          No participants enrolled or submitted yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#462E22] bg-[#110A07]/70 font-cinzel text-[11px] uppercase tracking-[1px] text-[#BFA98A]">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Participant</th>
                {visibleRounds.map((r) => (
                  <th key={r.id} className="px-4 py-3">
                    <span className="block truncate max-w-[160px]" title={r.title}>
                      {r.title}
                    </span>
                    <span className="font-fira text-[10px] font-normal text-[#BFA98A]/70">
                      {r.type.toUpperCase()}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3">Solved</th>
                <th className="px-4 py-3">Total Score</th>
                <th className="px-4 py-3">Violations</th>
                <th className="px-4 py-3">Runtime</th>
                <th className="px-4 py-3 text-right">Inspector</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#462E22]/50">
              {data.leaderboard.map((entry) => {
                const rankBadge =
                  entry.rank === 1
                    ? "bg-[#CA8A04]/25 text-[#CA8A04] border-[#DAA520]"
                    : entry.rank === 2
                    ? "bg-[#2A1810] text-[#F5E6D3] border-[#BFA98A]/60"
                    : entry.rank === 3
                    ? "bg-[#991B1B]/25 text-[#FCA5A5] border-[#B91C1C]"
                    : "bg-[#110A07] text-[#BFA98A] border-[#462E22]";

                const vCount = entry.violations ?? 0;

                return (
                  <tr
                    key={entry.userId}
                    className="hover:bg-[#2A1810]/50 transition-colors duration-300"
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex h-7 min-w-7 items-center justify-center rounded-[2px] border px-2 font-fira text-xs font-bold ${rankBadge}`}
                      >
                        #{entry.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-cinzel font-semibold text-[#F5E6D3]">
                        {entry.userName}
                      </div>
                      <div className="font-fira text-xs text-[#BFA98A]">
                        @{entry.userHandle}
                      </div>
                    </td>
                    {visibleRounds.map((r) => (
                      <td key={r.id} className="px-4 py-3 font-fira text-xs text-[#F5E6D3]">
                        {entry.roundScores[r.id] ?? 0} pts
                      </td>
                    ))}
                    <td className="px-4 py-3 font-fira text-xs text-[#F5E6D3]">
                      {entry.problemsSolved}{" "}
                      <span className="text-[#BFA98A]/70">/ {entry.problemsAttempted}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-fira text-sm font-bold text-[#22C55E]">
                        {entry.totalScore}
                      </span>
                      <span className="font-fira text-xs text-[#BFA98A]/70">
                        {" "}
                        / {entry.maxPossibleScore}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-fira text-xs">
                      <span
                        className={`rounded-[2px] border px-2 py-0.5 font-bold ${
                          vCount > 7
                            ? "border-[#B91C1C] bg-[#991B1B]/25 text-[#F87171]"
                            : vCount > 0
                            ? "border-[#CA8A04]/50 bg-[#CA8A04]/20 text-[#CA8A04]"
                            : "border-[#462E22] bg-[#110A07] text-[#BFA98A]"
                        }`}
                      >
                        {vCount} / 7
                      </span>
                    </td>
                    <td className="px-4 py-3 font-fira text-xs text-[#CA8A04]">
                      {entry.totalExecutionTimeMs > 0
                        ? `${entry.totalExecutionTimeMs.toFixed(2)} ms`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setInspectUserId(entry.userId)}
                        className="rounded-[4px] border border-[#462E22] bg-[#2A1810] px-2.5 py-1 font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#CA8A04] hover:border-[#CA8A04] transition-colors duration-300 cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Submission Inspector Modal */}
      {inspectUserId && inspectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#110A07]/85 p-4 backdrop-blur-md">
          <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-[6px] border border-[#462E22] border-t-2 border-t-[#CA8A04] bg-[#1D110B] shadow-[0_12px_40px_rgba(0,0,0,0.65)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#462E22] px-6 py-4">
              <div>
                <h4 className="font-cinzel text-base font-bold text-[#F5E6D3]">
                  Submission Inspector — {inspectedEntry.userName} (@{inspectedEntry.userHandle})
                </h4>
                <p className="font-fira text-xs text-[#BFA98A] mt-0.5">
                  Total Score: {inspectedEntry.totalScore} / {inspectedEntry.maxPossibleScore} pts
                  {" • "}Violations: {inspectedEntry.violations ?? 0} / 7
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectUserId(null)}
                className="rounded-[4px] border border-[#462E22] bg-[#2A1810] px-3 py-1 font-cinzel text-xs font-semibold text-[#BFA98A] hover:border-[#CA8A04] hover:text-[#F5E6D3] cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <h5 className="font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#CA8A04] mb-3">
                  Coding Submissions ({inspectedCoding.length})
                </h5>
                {inspectedCoding.length === 0 ? (
                  <p className="font-spectral text-xs text-[#BFA98A]">No coding submissions yet.</p>
                ) : (
                  <div className="space-y-4">
                    {inspectedCoding.map((sub) => (
                      <div
                        key={sub.id}
                        className="rounded-[4px] border border-[#462E22] bg-[#110A07] p-4 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-cinzel font-semibold text-sm text-[#F5E6D3]">
                              {qTitleMap.get(sub.questionId) || sub.questionId}
                            </span>
                            <span className="rounded-[2px] border border-[#462E22] bg-[#1D110B] px-2 py-0.5 font-fira text-[11px] uppercase text-[#CA8A04]">
                              {sub.language}
                            </span>
                            <span
                              className={`rounded-[2px] px-2 py-0.5 font-cinzel text-[11px] font-bold uppercase ${
                                sub.status === "Accepted"
                                  ? "bg-[#22C55E]/20 text-[#22C55E]"
                                  : "bg-[#991B1B]/25 text-[#F87171]"
                              }`}
                            >
                              {sub.status} ({sub.passedCount}/{sub.totalCount})
                            </span>
                          </div>
                          <div className="font-fira text-xs text-[#BFA98A]">
                            {sub.score}/{sub.maxScore} pts • {sub.executionTimeMs} ms •{" "}
                            {new Date(sub.submittedAt).toLocaleString()}
                          </div>
                        </div>
                        <pre className="max-h-60 overflow-auto rounded-[4px] border border-[#462E22] bg-[#1D110B] p-3 font-fira text-xs text-[#F5E6D3]">
                          {sub.sourceCode}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h5 className="font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#CA8A04] mb-3">
                  MCQ Submissions ({inspectedMcq.length})
                </h5>
                {inspectedMcq.length === 0 ? (
                  <p className="font-spectral text-xs text-[#BFA98A]">No MCQ submissions yet.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {inspectedMcq.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-2 text-xs"
                      >
                        <div>
                          <div className="font-cinzel font-semibold text-[#F5E6D3]">
                            {qTitleMap.get(sub.questionId) || sub.questionId}
                          </div>
                          <div className="font-spectral text-[#BFA98A]">
                            Selected: Option {sub.selectedOptionId.toUpperCase()}
                          </div>
                        </div>
                        <span
                          className={`rounded-[2px] px-2 py-0.5 font-fira font-bold ${
                            sub.isCorrect
                              ? "bg-[#22C55E]/20 text-[#22C55E]"
                              : "bg-[#991B1B]/25 text-[#F87171]"
                          }`}
                        >
                          {sub.score > 0 ? `+${sub.score}` : sub.score} pts
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
