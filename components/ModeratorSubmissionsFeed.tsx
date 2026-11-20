"use client";

import { CheckCircle2, Code2, Copy, RefreshCw } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import {
  formatDurationSeconds,
  getQuestionSummary,
  type CodingSubmission,
  type Contest,
  type Question,
} from "@/lib/types";

interface EnrichedCodingSubmission extends CodingSubmission {
  userName?: string;
  userHandle?: string;
}

interface ModeratorSubmissionsFeedProps {
  contest: Contest;
  questions: Question[];
}

function getVerdictStyle(status: string): string {
  if (status === "Accepted" || status === "Passed") {
    return "border-[#22C55E]/40 bg-[#22C55E]/15 text-[#22C55E]";
  }
  if (status === "Time Limit Exceeded" || status === "Partial") {
    return "border-[#CA8A04]/60 bg-[#CA8A04]/20 text-[#CA8A04]";
  }
  return "border-[#B91C1C]/70 bg-[#991B1B]/25 text-[#F87171]";
}

export function ModeratorSubmissionsFeed({
  contest,
  questions,
}: ModeratorSubmissionsFeedProps) {
  const [submissions, setSubmissions] = useState<EnrichedCodingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [filterRoundId, setFilterRoundId] = useState<string>("all");
  const [filterQuestionId, setFilterQuestionId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchUser, setSearchUser] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const qMap = new Map(questions.map((q) => [q.id, q]));
  const codingRounds = contest.rounds.filter((r) => r.type === "coding");

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/submissions/coding?contestId=${encodeURIComponent(contest.id)}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        const list = (data.submissions || []) as EnrichedCodingSubmission[];
        setSubmissions(list);
        setSelectedSubId((prev) =>
          prev && list.some((s) => s.id === prev) ? prev : list[0]?.id ?? null
        );
      }
    } finally {
      setLoading(false);
    }
  }, [contest.id]);

  useEffect(() => {
    let active = true;
    fetch(`/api/submissions/coding?contestId=${encodeURIComponent(contest.id)}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) return;
        const list = (data.submissions || []) as EnrichedCodingSubmission[];
        setSubmissions(list);
        setSelectedSubId((prev) =>
          prev && list.some((s) => s.id === prev) ? prev : list[0]?.id ?? null
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [contest.id]);

  const filtered = submissions.filter((s) => {
    if (filterRoundId !== "all" && s.roundId !== filterRoundId) return false;
    if (filterQuestionId !== "all" && s.questionId !== filterQuestionId) return false;
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    if (searchUser.trim()) {
      const q = searchUser.trim().toLowerCase();
      const nameMatch = (s.userName || "").toLowerCase().includes(q);
      const handleMatch = (s.userHandle || "").toLowerCase().includes(q);
      if (!nameMatch && !handleMatch) return false;
    }
    return true;
  });

  const activeSub =
    filtered.find((s) => s.id === selectedSubId) ?? filtered[0] ?? null;

  return (
    <div className="rounded-[4px] border border-[#462E22] border-t-2 border-t-[#CA8A04] bg-[#1D110B] shadow-[0_8px_24px_rgba(0,0,0,0.45)] overflow-hidden font-spectral text-[#F5E6D3]">
      {/* Header & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#462E22] bg-[#110A07]/60 px-5 py-4">
        <div>
          <h3 className="font-cinzel text-base font-bold text-[#F5E6D3] flex items-center gap-2">
            <Code2 className="h-4 w-4 text-[#CA8A04]" />
            Participant Code Submissions Inspector
          </h3>
          <p className="font-spectral text-xs text-[#BFA98A] mt-0.5">
            Inspect every code submission, compiler output, and test-case verdict submitted by participants in{" "}
            <strong className="text-[#F5E6D3]">{contest.title}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={searchUser}
            onChange={(e) => setSearchUser(e.target.value)}
            placeholder="Filter participant..."
            className="rounded-[4px] border border-[#462E22] bg-[#110A07] px-2.5 py-1.5 font-spectral text-xs text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none w-40"
          />

          <select
            value={filterRoundId}
            onChange={(e) => setFilterRoundId(e.target.value)}
            className="rounded-[4px] border border-[#462E22] bg-[#110A07] px-2.5 py-1.5 font-spectral text-xs text-[#F5E6D3]"
          >
            <option value="all">All Coding Rounds</option>
            {codingRounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>

          <select
            value={filterQuestionId}
            onChange={(e) => setFilterQuestionId(e.target.value)}
            className="rounded-[4px] border border-[#462E22] bg-[#110A07] px-2.5 py-1.5 font-spectral text-xs text-[#F5E6D3] max-w-[180px]"
          >
            <option value="all">All Questions</option>
            {questions
              .filter((q) => q.kind === "coding")
              .map((q) => (
                <option key={q.id} value={q.id}>
                  {getQuestionSummary(q, 40)}
                </option>
              ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-[4px] border border-[#462E22] bg-[#110A07] px-2.5 py-1.5 font-spectral text-xs text-[#F5E6D3]"
          >
            <option value="all">All Verdicts</option>
            <option value="Accepted">Accepted</option>
            <option value="Wrong Answer">Wrong Answer</option>
            <option value="Time Limit Exceeded">Time Limit Exceeded</option>
            <option value="Compilation Error">Compilation Error</option>
            <option value="Runtime Error">Runtime Error</option>
          </select>

          <button
            type="button"
            onClick={loadSubmissions}
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#462E22] bg-[#2A1810] px-3 py-1.5 font-cinzel text-xs font-semibold uppercase tracking-[0.5px] text-[#F5E6D3] hover:border-[#CA8A04] cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5 text-[#CA8A04]" />
            Refresh
          </button>
        </div>
      </div>

      {loading && submissions.length === 0 ? (
        <div className="p-8 text-center font-spectral text-sm text-[#BFA98A]">
          Loading participant code submissions...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center font-spectral text-sm text-[#BFA98A]">
          No coding submissions match the selected filters yet.
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#462E22]">
          {/* Left List of Submissions */}
          <div className="lg:col-span-5 max-h-[640px] overflow-y-auto divide-y divide-[#462E22]/60 bg-[#160C08]">
            {filtered.map((sub) => {
              const qObj = qMap.get(sub.questionId);
              const isSelected = activeSub?.id === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSelectedSubId(sub.id)}
                  className={`w-full p-4 text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[#2A1810] border-l-2 border-l-[#CA8A04]"
                      : "hover:bg-[#1D110B]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-cinzel text-xs font-bold text-[#F5E6D3]">
                        {sub.userName || sub.userId}
                      </span>
                      {sub.userHandle && (
                        <span className="ml-1.5 font-fira text-[11px] text-[#BFA98A]">
                          @{sub.userHandle}
                        </span>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-[2px] border px-2 py-0.5 font-cinzel text-[10px] font-bold uppercase ${getVerdictStyle(
                        sub.status
                      )}`}
                    >
                      {sub.status}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-cinzel font-semibold text-[#CA8A04] truncate">
                      {qObj ? getQuestionSummary(qObj, 42) : sub.questionId}
                    </span>
                    <span className="font-fira text-[11px] text-[#F5E6D3]">
                      {sub.score}/{sub.maxScore} pts ({sub.passedCount}/{sub.totalCount})
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 font-fira text-[10px] text-[#BFA98A]">
                    <span>
                      {sub.language.toUpperCase()} • {sub.executionTimeMs} ms
                      {sub.timeTakenSeconds
                        ? ` • Solve ${formatDurationSeconds(sub.timeTakenSeconds)}`
                        : ""}
                    </span>
                    <span>{new Date(sub.submittedAt).toLocaleTimeString()}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Detailed Code & Test-Case Inspector */}
          <div className="lg:col-span-7 p-5 space-y-4 max-h-[640px] overflow-y-auto bg-[#1D110B]">
            {activeSub && (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#462E22] pb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-cinzel text-base font-bold text-[#F5E6D3]">
                        {activeSub.userName || activeSub.userId}
                      </h4>
                      <span className="rounded-[2px] border border-[#462E22] bg-[#110A07] px-2 py-0.5 font-fira text-xs uppercase text-[#CA8A04]">
                        {activeSub.language}
                      </span>
                      <span
                        className={`rounded-[2px] border px-2 py-0.5 font-cinzel text-xs font-bold uppercase ${getVerdictStyle(
                          activeSub.status
                        )}`}
                      >
                        {activeSub.status}
                      </span>
                    </div>
                    <p className="font-fira text-xs text-[#BFA98A] mt-1">
                      Question:{" "}
                      <strong className="text-[#F5E6D3]">
                        {qMap.get(activeSub.questionId)
                          ? getQuestionSummary(qMap.get(activeSub.questionId)!)
                          : activeSub.questionId}
                      </strong>{" "}
                      • Score: {activeSub.score}/{activeSub.maxScore} pts • Passed:{" "}
                      {activeSub.passedCount}/{activeSub.totalCount} • Runtime:{" "}
                      {activeSub.executionTimeMs} ms
                      {activeSub.timeTakenSeconds
                        ? ` • Solve Time: ${formatDurationSeconds(
                            activeSub.timeTakenSeconds
                          )}`
                        : ""}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(activeSub.sourceCode);
                      setCopiedId(activeSub.id);
                      setTimeout(() => setCopiedId(null), 1500);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-1.5 font-cinzel text-[11px] font-semibold uppercase text-[#CA8A04] hover:border-[#CA8A04] cursor-pointer"
                  >
                    {copiedId === activeSub.id ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#22C55E]" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy Code
                      </>
                    )}
                  </button>
                </div>

                {/* Source Code Box */}
                <div>
                  <div className="font-cinzel text-[10px] font-bold uppercase tracking-[1px] text-[#BFA98A] mb-1.5">
                    Submitted Source Code ({activeSub.sourceCode.split("\n").length} lines)
                  </div>
                  <pre className="max-h-72 overflow-auto rounded-[4px] border border-[#462E22] bg-[#110A07] p-3.5 font-fira text-xs leading-relaxed text-[#F5E6D3]">
                    {activeSub.sourceCode}
                  </pre>
                </div>

                {activeSub.compileError && (
                  <div>
                    <div className="font-cinzel text-[10px] font-bold uppercase tracking-[1px] text-[#F87171] mb-1">
                      Compiler / Sandbox Error Output
                    </div>
                    <pre className="rounded-[4px] border border-[#B91C1C] bg-[#991B1B]/20 p-3 font-fira text-xs text-[#FCA5A5] whitespace-pre-wrap">
                      {activeSub.compileError}
                    </pre>
                  </div>
                )}

                {/* Per-Test-Case Breakdown */}
                {activeSub.testCaseResults &&
                  activeSub.testCaseResults.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-cinzel text-[10px] font-bold uppercase tracking-[1px] text-[#BFA98A]">
                        Test Case Results ({activeSub.passedCount}/
                        {activeSub.totalCount} Passed)
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {activeSub.testCaseResults.map((tc, idx) => (
                          <div
                            key={tc.testCaseId || idx}
                            className="rounded-[4px] border border-[#462E22] bg-[#110A07] p-2.5 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-fira font-bold text-[#F5E6D3]">
                                #{idx + 1}
                              </span>
                              <span className="rounded-[2px] border border-[#462E22] bg-[#1D110B] px-1.5 py-0.5 font-cinzel text-[9px] uppercase text-[#BFA98A]">
                                {tc.isSample ? "Sample" : "Hidden"}
                              </span>
                              <span
                                className={`rounded-[2px] border px-1.5 py-0.5 font-cinzel text-[10px] font-bold uppercase ${getVerdictStyle(
                                  tc.passed ? "Accepted" : tc.status
                                )}`}
                              >
                                {tc.passed ? "Accepted" : tc.status}
                              </span>
                            </div>
                            <span className="font-fira text-[11px] text-[#BFA98A]">
                              {tc.executionTimeMs} ms
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
