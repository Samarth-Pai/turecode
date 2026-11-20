"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  Columns2,
  Lock,
  Maximize2,
  Minimize2,
  Moon,
  PanelBottom,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRight,
  Play,
  RotateCcw,
  Rows2,
  Send,
  Sun,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CodeEditor } from "@/components/CodeEditor";
import { useUser } from "@/components/UserContext";
import {
  SUPPORTED_LANGUAGES,
  type CodingQuestion,
  type CodingSubmission,
  type CodingTestCaseResult,
  type LanguageId,
  type Round,
} from "@/lib/types";

interface CodingRoundArenaProps {
  contestId: string;
  contestTitle: string;
  round: Round;
  questions: CodingQuestion[];
  scheduleStatus: "UPCOMING" | "ACTIVE" | "ENDED";
}

interface RunOrSubmitOutput {
  kind: "custom" | "run" | "submit";
  status: string;
  executionTimeMs: number;
  runId: string;
  output?: string;
  error?: string | null;
  compileError?: string;
  score?: number;
  maxScore?: number;
  passedCount?: number;
  totalCount?: number;
  testCaseResults?: CodingTestCaseResult[];
}

function getStatusBadgeStyle(status: string): string {
  switch (status) {
    case "Accepted":
    case "Passed":
    case "Executed":
    case "Submitted":
      return "border-[#22C55E]/40 bg-[#22C55E]/15 text-[#22C55E]";
    case "Time Limit Exceeded":
    case "Partial":
      return "border-[#CA8A04]/60 bg-[#CA8A04]/20 text-[#CA8A04]";
    default:
      return "border-[#B91C1C]/70 bg-[#991B1B]/25 text-[#F87171]";
  }
}

function formatCaseStatusLabel(tc: CodingTestCaseResult): string {
  if (tc.status === "Passed") return "Accepted";
  if (tc.status === "Time Limit Exceeded") return "Time Limit Exceeded";
  if (tc.status === "Compilation Error") return "Compile Error";
  return tc.status;
}

export function CodingRoundArena({
  contestId,
  contestTitle,
  round,
  questions,
  scheduleStatus,
}: CodingRoundArenaProps) {
  const { currentUser } = useUser();
  const [activeQIndex, setActiveQIndex] = useState(0);
  const [language, setLanguage] = useState<LanguageId>("cpp");
  const [leftTab, setLeftTab] = useState<"problem" | "submissions">("problem");
  const [questionRailCollapsed, setQuestionRailCollapsed] = useState(false);

  // Flexible layout & editor preferences
  const [leftWidthPct, setLeftWidthPct] = useState(44);
  const [problemCollapsed, setProblemCollapsed] = useState(false);
  const [stackedVertical, setStackedVertical] = useState(false);
  const [consoleHeightPx, setConsoleHeightPx] = useState(235);
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"testcase" | "result">("testcase");
  const [selectedSampleIdx, setSelectedSampleIdx] = useState(0);
  const [selectedResultCaseIdx, setSelectedResultCaseIdx] = useState(0);
  const [editorTheme, setEditorTheme] = useState<"dark" | "light">("dark");
  const [fontSize, setFontSize] = useState(14);
  const [wordWrap, setWordWrap] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const draftsStorageKey = `turecode_code_drafts_${contestId}_${round.id}`;
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(draftsStorageKey);
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });
  const [showHead, setShowHead] = useState(false);
  const [showTail, setShowTail] = useState(false);

  const [useCustomInput, setUseCustomInput] = useState(false);
  const [customInput, setCustomInput] = useState(() => {
    const firstQ = questions[0];
    if (!firstQ) return "";
    const firstSample = firstQ.testCases.find((tc) => tc.isSample);
    return firstSample?.input ?? firstQ.testCases[0]?.input ?? "";
  });
  const [running, setRunning] = useState<"run" | "submit" | null>(null);
  const [consoleRes, setConsoleRes] = useState<RunOrSubmitOutput | null>(null);
  const [submissions, setSubmissions] = useState<CodingSubmission[]>([]);
  const [acceptedQIds, setAcceptedQIds] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement | null>(null);
  const rightPaneRef = useRef<HTMLDivElement | null>(null);

  const activeQ = questions[activeQIndex] ?? questions[0];
  const sampleCases = useMemo(
    () => (activeQ ? activeQ.testCases.filter((tc) => tc.isSample) : []),
    [activeQ]
  );

  const extraSymbols = useMemo(() => {
    if (!activeQ?.dslSource) return [];
    const match = activeQ.dslSource.match(/function\s*\(([^)]+)\)/i);
    if (!match) return [];
    const parts = match[1].split(",").map((s) => s.trim());
    const syms: string[] = [];
    if (parts[1]) syms.push(parts[1]);
    for (let i = 2; i < parts.length; i++) {
      const tokens = parts[i].split(/\s+/);
      if (tokens[1]) syms.push(tokens[1]);
    }
    return syms;
  }, [activeQ]);

  const selectQuestion = useCallback(
    (idx: number) => {
      const q = questions[idx];
      if (!q) return;
      setActiveQIndex(idx);
      setLeftTab("problem");
      setProblemCollapsed(false);
      setSelectedSampleIdx(0);
      setSelectedResultCaseIdx(0);
      const firstSample = q.testCases.find((tc) => tc.isSample);
      setCustomInput(firstSample?.input ?? q.testCases[0]?.input ?? "");
      setConsoleRes(null);
      setDrawerTab("testcase");
    },
    [questions]
  );

  const loadRoundStatuses = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(
        `/api/submissions/coding?contestId=${encodeURIComponent(
          contestId
        )}&roundId=${encodeURIComponent(round.id)}&userId=${encodeURIComponent(
          currentUser.id
        )}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        const allSubs = (data.submissions || []) as CodingSubmission[];
        const nextSet = new Set<string>();
        for (const s of allSubs) {
          if (s.status === "Accepted") nextSet.add(s.questionId);
        }
        setAcceptedQIds(nextSet);
        if (activeQ) {
          setSubmissions(allSubs.filter((s) => s.questionId === activeQ.id));
        }
      }
    } catch {
      // ignore
    }
  }, [contestId, round.id, activeQ, currentUser]);

  useEffect(() => {
    if (!activeQ || !currentUser) return;
    fetch("/api/attempts/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contestId,
        roundId: round.id,
        questionId: activeQ.id,
        userId: currentUser.id,
      }),
    }).catch(() => undefined);
  }, [contestId, round.id, activeQ, currentUser]);

  useEffect(() => {
    if (!activeQ || !currentUser) return;
    let active = true;
    fetch(
      `/api/submissions/coding?contestId=${encodeURIComponent(
        contestId
      )}&roundId=${encodeURIComponent(round.id)}&userId=${encodeURIComponent(
        currentUser.id
      )}`,
      { cache: "no-store" }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) return;
        const allSubs = (data.submissions || []) as CodingSubmission[];
        const nextSet = new Set<string>();
        for (const s of allSubs) {
          if (s.status === "Accepted") nextSet.add(s.questionId);
        }
        setAcceptedQIds(nextSet);
        setSubmissions(allSubs.filter((s) => s.questionId === activeQ.id));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [contestId, round.id, activeQ, currentUser]);

  const draftKey = activeQ ? `${activeQ.id}:${language}` : "";
  const stub = activeQ?.codeStubs?.[language] ?? { head: "", body: "", tail: "" };
  const currentCode = draftKey in drafts ? drafts[draftKey] : stub.body;

  const setCurrentCode = (val: string) => {
    if (!draftKey) return;
    setDrafts((prev) => {
      const next = { ...prev, [draftKey]: val };
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(draftsStorageKey, JSON.stringify(next));
        } catch {
          // ignore storage quota errors
        }
      }
      return next;
    });
  };

  const handleLoadSampleSolution = () => {
    if (!activeQ?.sampleSolutions?.[language]) return;
    setCurrentCode(activeQ.sampleSolutions[language]!);
  };

  const handleResetStub = () => {
    setCurrentCode(stub.body);
  };

  const isModerator = currentUser?.role === "moderator";

  const executeCode = useCallback(
    async (mode: "run" | "submit") => {
      if (!activeQ || !currentUser) return;
      setRunning(mode);
      setConsoleCollapsed(false);
      setDrawerTab("result");
      setSelectedResultCaseIdx(0);
      try {
        const res = await fetch("/api/submissions/coding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contestId,
            roundId: round.id,
            questionId: activeQ.id,
            userId: currentUser.id,
            language,
            sourceCode: currentCode,
            mode,
            useCustomInput: mode === "run" && useCustomInput,
            customInput,
            moderatorOverride: currentUser.role === "moderator",
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setConsoleRes({
            kind: mode,
            status: "Error",
            executionTimeMs: 0,
            runId: "-",
            error: data.error || "Execution failed",
          });
          return;
        }

        if (mode === "run" && data.customRun) {
          setConsoleRes({
            kind: "custom",
            status: data.status,
            executionTimeMs: data.executionTimeMs,
            runId: data.runId,
            output: data.output,
            error: data.error,
          });
        } else if (mode === "run") {
          setConsoleRes({
            kind: "run",
            status: data.status,
            executionTimeMs: data.executionTimeMs,
            runId: data.runId,
            compileError: data.compileError,
            score: data.score,
            maxScore: data.maxScore,
            passedCount: data.passedCount,
            totalCount: data.totalCount,
            testCaseResults: data.testCaseResults,
          });
        } else {
          const sub = data.submission as CodingSubmission;
          setConsoleRes({
            kind: "submit",
            status: sub.status,
            executionTimeMs: sub.executionTimeMs ?? 0,
            runId: sub.runId ?? sub.id,
            compileError: sub.compileError,
            score: isModerator ? sub.score : undefined,
            maxScore: isModerator ? sub.maxScore : undefined,
            passedCount: sub.passedCount,
            totalCount: sub.totalCount,
            testCaseResults: sub.testCaseResults,
          });
          await loadRoundStatuses();
        }
      } finally {
        setRunning(null);
      }
    },
    [
      activeQ,
      currentUser,
      contestId,
      round.id,
      language,
      currentCode,
      useCustomInput,
      customInput,
      isModerator,
      loadRoundStatuses,
    ]
  );

  const startHorizontalDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const onMove = (moveEv: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;
      const pct = ((moveEv.clientX - rect.left) / rect.width) * 100;
      setProblemCollapsed(false);
      setLeftWidthPct(Math.min(64, Math.max(24, pct)));
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startVerticalDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const pane = rightPaneRef.current;
    if (!pane) return;

    const onMove = (moveEv: MouseEvent) => {
      const rect = pane.getBoundingClientRect();
      const nextHeight = rect.bottom - moveEv.clientY - 34;
      setConsoleCollapsed(false);
      setConsoleHeightPx(Math.min(440, Math.max(120, nextHeight)));
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  if (!activeQ) {
    return (
      <div className="mx-auto max-w-4xl p-8 text-center font-spectral text-sm text-[#BFA98A]">
        No coding problems have been added to this round yet.
      </div>
    );
  }

  const canSubmit =
    Boolean(currentUser) &&
    (scheduleStatus === "ACTIVE" || currentUser?.role === "moderator");

  const activeResultCase =
    consoleRes?.testCaseResults?.[selectedResultCaseIdx] ??
    consoleRes?.testCaseResults?.[0];

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col bg-[#110A07] text-[#F5E6D3] font-spectral ${
        isFullscreen ? "fixed inset-0 z-50" : "h-full"
      }`}
    >
      {/* Top Assessment Action Bar (Single Row) */}
      <div className="shrink-0 border-b border-[#462E22] bg-[#1D110B] px-4 py-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/contests/${contestId}`}
            className="shrink-0 rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-1.5 font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] hover:border-[#CA8A04] hover:text-[#F5E6D3] transition-colors duration-300"
          >
            ← {contestTitle}
          </Link>

          <div className="hidden sm:flex items-center gap-2 min-w-0">
            <span className="rounded-[2px] border border-[#462E22] bg-[#110A07] px-2 py-0.5 font-fira text-[10px] uppercase tracking-[0.8px] text-[#CA8A04]">
              Q{String(activeQIndex + 1).padStart(2, "0")} /{" "}
              {String(questions.length).padStart(2, "0")}
            </span>
            <span className="truncate font-cinzel text-xs font-semibold text-[#F5E6D3] max-w-[260px]">
              {activeQ.title}
            </span>
          </div>
        </div>

        {/* Icon-Only Layout Presets + Run / Submit */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="hidden lg:flex items-center gap-0.5 rounded-[4px] border border-[#462E22] bg-[#110A07] p-0.5">
            <button
              type="button"
              title="Balanced Split Layout (50/50)"
              aria-label="Balanced Split Layout"
              onClick={() => {
                setStackedVertical(false);
                setProblemCollapsed(false);
                setLeftWidthPct(44);
              }}
              className={`rounded-[2px] p-1.5 cursor-pointer transition-colors duration-200 ${
                !problemCollapsed &&
                !stackedVertical &&
                Math.abs(leftWidthPct - 44) < 5
                  ? "bg-[#2A1810] text-[#CA8A04]"
                  : "text-[#BFA98A] hover:text-[#F5E6D3]"
              }`}
            >
              <Columns2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Wide Code Editor Layout"
              aria-label="Wide Code Editor Layout"
              onClick={() => {
                setStackedVertical(false);
                setProblemCollapsed(false);
                setLeftWidthPct(28);
              }}
              className={`rounded-[2px] p-1.5 cursor-pointer transition-colors duration-200 ${
                !problemCollapsed && !stackedVertical && leftWidthPct <= 30
                  ? "bg-[#2A1810] text-[#CA8A04]"
                  : "text-[#BFA98A] hover:text-[#F5E6D3]"
              }`}
            >
              <PanelLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Wide Problem Description Layout"
              aria-label="Wide Problem Description Layout"
              onClick={() => {
                setStackedVertical(false);
                setProblemCollapsed(false);
                setLeftWidthPct(58);
              }}
              className={`rounded-[2px] p-1.5 cursor-pointer transition-colors duration-200 ${
                !problemCollapsed && !stackedVertical && leftWidthPct >= 54
                  ? "bg-[#2A1810] text-[#CA8A04]"
                  : "text-[#BFA98A] hover:text-[#F5E6D3]"
              }`}
            >
              <PanelRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Vertical Stacked Layout (Problem Top / Code Bottom)"
              aria-label="Vertical Stacked Layout"
              onClick={() => {
                setProblemCollapsed(false);
                setStackedVertical((v) => !v);
              }}
              className={`rounded-[2px] p-1.5 cursor-pointer transition-colors duration-200 ${
                !problemCollapsed && stackedVertical
                  ? "bg-[#2A1810] text-[#CA8A04]"
                  : "text-[#BFA98A] hover:text-[#F5E6D3]"
              }`}
            >
              <Rows2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title={problemCollapsed ? "Show Problem Pane" : "Focus Code Only (Hide Problem)"}
              aria-label="Focus Code Only"
              onClick={() => setProblemCollapsed((v) => !v)}
              className={`rounded-[2px] p-1.5 cursor-pointer transition-colors duration-200 ${
                problemCollapsed
                  ? "bg-[#2A1810] text-[#CA8A04]"
                  : "text-[#BFA98A] hover:text-[#F5E6D3]"
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title={consoleCollapsed ? "Expand Output Console" : "Minimize Output Console"}
              aria-label="Toggle Output Console"
              onClick={() => setConsoleCollapsed((v) => !v)}
              className={`rounded-[2px] p-1.5 cursor-pointer transition-colors duration-200 ${
                !consoleCollapsed
                  ? "bg-[#2A1810] text-[#CA8A04]"
                  : "text-[#BFA98A] hover:text-[#F5E6D3]"
              }`}
            >
              <PanelBottom className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsFullscreen((v) => !v)}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Workspace"}
            aria-label="Toggle Fullscreen Workspace"
            className="inline-flex items-center justify-center rounded-[4px] border border-[#462E22] bg-[#110A07] p-1.5 text-[#BFA98A] hover:border-[#CA8A04]/60 hover:text-[#F5E6D3] transition-colors duration-300 cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>

          <span className="mx-1 hidden h-5 w-px bg-[#462E22] sm:inline-block" />

          <button
            type="button"
            disabled={running !== null}
            onClick={() => executeCode("run")}
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#CA8A04]/70 bg-[#2A1810] px-3.5 py-1.5 font-cinzel text-xs font-bold uppercase tracking-[0.5px] text-[#F5E6D3] hover:border-[#DAA520] hover:bg-[#462E22]/50 disabled:opacity-50 transition-all duration-300 cursor-pointer"
          >
            <Play className="h-3.5 w-3.5 text-[#CA8A04]" />
            {running === "run" ? "Running..." : "Run"}
          </button>
          <button
            type="button"
            disabled={running !== null || !canSubmit}
            onClick={() => executeCode("submit")}
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-4 py-1.5 font-cinzel text-xs font-bold uppercase tracking-[0.5px] text-[#110A07] shadow-[0_0_16px_rgba(202,138,4,0.28)] hover:bg-[#B8780A] disabled:opacity-50 transition-all duration-300 cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
            {running === "submit" ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>

      {/* Main Split Workspace with Left Question Sidebar */}
      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Mobile Question Switcher Strip (< lg only) */}
        <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto border-b border-[#462E22] bg-[#160C08] px-3 py-2 shrink-0">
          {questions.map((q, idx) => (
            <button
              key={q.id}
              type="button"
              onClick={() => selectQuestion(idx)}
              className={`shrink-0 rounded-[4px] border px-2.5 py-1 font-cinzel text-[11px] font-semibold cursor-pointer transition-colors ${
                idx === activeQIndex
                  ? "border-[#DAA520] bg-[#2A1810] text-[#CA8A04]"
                  : "border-[#462E22] bg-[#1D110B] text-[#BFA98A]"
              }`}
            >
              {String(idx + 1).padStart(2, "0")}. {q.title}
            </button>
          ))}
        </div>

        {/* Desktop Left Question Sidebar */}
        <aside
          aria-label="Round Questions Menu"
          className={`hidden lg:flex flex-col shrink-0 border-r border-[#462E22] bg-[#160C08] transition-all duration-200 ${
            questionRailCollapsed ? "w-14" : "w-56"
          }`}
        >
          <div className="flex items-center justify-between border-b border-[#462E22] px-3 py-2.5">
            {!questionRailCollapsed && (
              <span className="font-cinzel text-[10px] font-bold uppercase tracking-[1px] text-[#CA8A04]">
                Problems ({questions.length})
              </span>
            )}
            <button
              type="button"
              onClick={() => setQuestionRailCollapsed((v) => !v)}
              title={questionRailCollapsed ? "Expand problems menu" : "Collapse problems menu"}
              className={`rounded-[4px] border border-[#462E22] bg-[#1D110B] p-1 text-[#BFA98A] hover:border-[#CA8A04] hover:text-[#F5E6D3] cursor-pointer ${
                questionRailCollapsed ? "mx-auto" : ""
              }`}
            >
              {questionRailCollapsed ? (
                <PanelLeftOpen className="h-3.5 w-3.5" />
              ) : (
                <PanelLeftClose className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {questions.map((q, idx) => {
              const isActive = idx === activeQIndex;
              const isSolved = acceptedQIds.has(q.id);
              const diffDot =
                q.difficulty === "Easy"
                  ? "bg-[#22C55E]"
                  : q.difficulty === "Medium"
                  ? "bg-[#CA8A04]"
                  : "bg-[#F87171]";

              if (questionRailCollapsed) {
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => selectQuestion(idx)}
                    title={`${idx + 1}. ${q.title} (${q.difficulty})`}
                    className={`relative flex w-full flex-col items-center justify-center rounded-[4px] border py-2.5 font-fira text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? "border-[#DAA520] bg-[#2A1810] text-[#CA8A04] shadow-[0_0_12px_rgba(202,138,4,0.18)]"
                        : "border-[#462E22]/70 bg-[#1D110B]/60 text-[#BFA98A] hover:border-[#CA8A04]/50 hover:text-[#F5E6D3]"
                    }`}
                  >
                    {String(idx + 1).padStart(2, "0")}
                    <span
                      className={`mt-1 h-1.5 w-1.5 rounded-full ${
                        isSolved ? "bg-[#22C55E]" : diffDot
                      }`}
                    />
                  </button>
                );
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => selectQuestion(idx)}
                  className={`w-full rounded-[4px] border p-2.5 text-left transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "border-[#462E22] border-l-2 border-l-[#CA8A04] bg-[#2A1810] shadow-[0_0_12px_rgba(202,138,4,0.15)]"
                      : "border-transparent bg-[#1D110B]/60 hover:border-[#462E22] hover:bg-[#1D110B]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`font-fira text-[10px] font-bold ${
                        isActive ? "text-[#CA8A04]" : "text-[#BFA98A]"
                      }`}
                    >
                      #{String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isSolved && (
                        <CheckCircle2 className="h-3 w-3 text-[#22C55E]" />
                      )}
                      <span
                        className={`rounded-[2px] border px-1.5 py-0.5 font-cinzel text-[9px] font-bold uppercase tracking-[0.5px] ${
                          q.difficulty === "Easy"
                            ? "border-[#22C55E]/35 bg-[#22C55E]/10 text-[#22C55E]"
                            : q.difficulty === "Medium"
                            ? "border-[#CA8A04]/40 bg-[#CA8A04]/10 text-[#CA8A04]"
                            : "border-[#B91C1C]/50 bg-[#991B1B]/20 text-[#F87171]"
                        }`}
                      >
                        {q.difficulty}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`mt-1 font-cinzel text-xs font-semibold leading-snug line-clamp-2 ${
                      isActive ? "text-[#F5E6D3]" : "text-[#BFA98A]"
                    }`}
                  >
                    {q.title}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Problem Description + Code IDE Resizable Split Area */}
        <div
          ref={containerRef}
          className={`flex flex-1 flex-col ${
            stackedVertical ? "" : "lg:flex-row"
          } overflow-hidden min-h-0`}
        >
          {/* Left / Top Problem Pane */}
          {!problemCollapsed && (
            <div
              style={
                stackedVertical
                  ? undefined
                  : ({ "--left-w": `${leftWidthPct}%` } as React.CSSProperties)
              }
              className={`w-full ${
                stackedVertical
                  ? "h-[42%] shrink-0 border-b"
                  : "lg:w-[var(--left-w)] lg:shrink-0 border-b lg:border-b-0"
              } flex flex-col border-[#462E22] bg-[#1D110B] min-h-[220px] lg:min-h-0 overflow-hidden`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-[#462E22] bg-[#110A07] px-3 py-1.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLeftTab("problem")}
                    className={`whitespace-nowrap rounded-[4px] px-2.5 py-1 font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] transition-colors duration-300 cursor-pointer ${
                      leftTab === "problem"
                        ? "border border-[#CA8A04]/50 bg-[#2A1810] text-[#F5E6D3]"
                        : "text-[#BFA98A] hover:text-[#F5E6D3]"
                    }`}
                  >
                    Description
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeftTab("submissions")}
                    className={`whitespace-nowrap rounded-[4px] px-2.5 py-1 font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] transition-colors duration-300 cursor-pointer ${
                      leftTab === "submissions"
                        ? "border border-[#CA8A04]/50 bg-[#2A1810] text-[#F5E6D3]"
                        : "text-[#BFA98A] hover:text-[#F5E6D3]"
                    }`}
                  >
                    Submissions ({submissions.length})
                  </button>
                </div>
                <span className="hidden xl:inline whitespace-nowrap font-fira text-[10px] text-[#BFA98A]">
                  {activeQ.testCases.length} cases ({sampleCases.length} sample)
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {leftTab === "problem" ? (
                  <>
                    <div className="border-b border-[#462E22]/70 pb-3.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h1 className="font-cinzel text-xl font-bold text-[#F5E6D3]">
                          {activeQ.title}
                        </h1>
                        <span
                          className={`rounded-[2px] px-2.5 py-0.5 font-cinzel text-[10px] font-bold uppercase tracking-[1px] border ${
                            activeQ.difficulty === "Easy"
                              ? "border-[#22C55E]/40 bg-[#22C55E]/15 text-[#22C55E]"
                              : activeQ.difficulty === "Medium"
                              ? "border-[#CA8A04]/50 bg-[#CA8A04]/15 text-[#CA8A04]"
                              : "border-[#B91C1C]/60 bg-[#991B1B]/25 text-[#F87171]"
                          }`}
                        >
                          {activeQ.difficulty}
                        </span>
                        {isModerator && (
                          <span className="font-fira text-xs text-[#CA8A04]">
                            {activeQ.points} pts
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="font-spectral text-[15px] leading-[1.7] text-[#F5E6D3]/95 whitespace-pre-line">
                      {activeQ.description}
                    </div>

                    <div className="space-y-3 rounded-[4px] border border-[#462E22] bg-[#110A07] p-4 text-xs">
                      <div>
                        <div className="font-cinzel font-bold uppercase tracking-[1px] text-[#CA8A04] mb-1">
                          Input Format
                        </div>
                        <p className="font-spectral text-sm text-[#BFA98A] whitespace-pre-line">
                          {activeQ.inputFormat}
                        </p>
                      </div>
                      <div className="border-t border-[#462E22] pt-3">
                        <div className="font-cinzel font-bold uppercase tracking-[1px] text-[#CA8A04] mb-1">
                          Constraints
                        </div>
                        <pre className="font-fira text-xs text-[#F5E6D3] whitespace-pre-wrap">
                          {activeQ.constraints}
                        </pre>
                      </div>
                      <div className="border-t border-[#462E22] pt-3">
                        <div className="font-cinzel font-bold uppercase tracking-[1px] text-[#CA8A04] mb-1">
                          Output Format
                        </div>
                        <p className="font-spectral text-sm text-[#BFA98A] whitespace-pre-line">
                          {activeQ.outputFormat}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#BFA98A]">
                        Sample Test Cases ({sampleCases.length})
                      </h3>
                      {sampleCases.map((tc, idx) => (
                        <div
                          key={tc.id}
                          className="rounded-[4px] border border-[#462E22] bg-[#110A07] p-3.5 space-y-3"
                        >
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <div className="font-cinzel text-[10px] font-bold uppercase tracking-[1px] text-[#BFA98A] mb-1">
                                Sample Input {idx + 1}
                              </div>
                              <pre className="rounded-[4px] border border-[#462E22] bg-[#1D110B] p-2.5 font-fira text-xs text-[#F5E6D3] overflow-x-auto">
                                {tc.input.trimEnd()}
                              </pre>
                            </div>
                            <div>
                              <div className="font-cinzel text-[10px] font-bold uppercase tracking-[1px] text-[#BFA98A] mb-1">
                                Sample Output {idx + 1}
                              </div>
                              <pre className="rounded-[4px] border border-[#462E22] bg-[#1D110B] p-2.5 font-fira text-xs text-[#22C55E] overflow-x-auto">
                                {tc.expectedOutput.trimEnd()}
                              </pre>
                            </div>
                          </div>
                          {tc.explanation && (
                            <div className="rounded-[4px] border border-[#462E22] border-l-2 border-l-[#CA8A04] bg-[#160C08] px-3 py-2 font-spectral text-xs text-[#F5E6D3] leading-relaxed">
                              <strong className="font-cinzel text-[11px] uppercase tracking-[0.5px] text-[#CA8A04]">
                                Explanation:
                              </strong>{" "}
                              {tc.explanation}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    {submissions.length === 0 ? (
                      <p className="font-spectral text-xs text-[#BFA98A]">
                        No submissions yet for {activeQ.title}.
                      </p>
                    ) : (
                      submissions.map((sub) => (
                        <div
                          key={sub.id}
                          className="rounded-[4px] border border-[#462E22] bg-[#110A07] p-4 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded-[2px] border px-2 py-0.5 font-cinzel text-[11px] font-bold uppercase tracking-[0.5px] ${getStatusBadgeStyle(
                                  sub.status
                                )}`}
                              >
                                {sub.status}
                              </span>
                              <span className="rounded-[2px] border border-[#462E22] bg-[#1D110B] px-2 py-0.5 font-fira text-[11px] uppercase text-[#CA8A04]">
                                {sub.language}
                              </span>
                              {sub.totalCount !== undefined && sub.totalCount > 0 && (
                                <span className="font-fira text-[11px] text-[#BFA98A]">
                                  {sub.passedCount}/{sub.totalCount} cases
                                </span>
                              )}
                            </div>
                            <span className="font-fira text-xs text-[#BFA98A]">
                              {isModerator && sub.maxScore !== undefined
                                ? `${sub.score}/${sub.maxScore} pts • `
                                : ""}
                              {sub.executionTimeMs !== undefined ? `${sub.executionTimeMs} ms` : ""}
                            </span>
                          </div>

                          <div className="flex items-center justify-between font-spectral text-xs text-[#BFA98A]">
                            <span>{new Date(sub.submittedAt).toLocaleString()}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setLanguage(sub.language);
                                setDrafts((prev) => ({
                                  ...prev,
                                  [`${activeQ.id}:${sub.language}`]: sub.sourceCode,
                                }));
                              }}
                              className="font-cinzel text-[11px] font-semibold text-[#CA8A04] hover:underline cursor-pointer"
                            >
                              Load into Editor
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Draggable Horizontal Resizer */}
          {!problemCollapsed && !stackedVertical && (
            <div
              onMouseDown={startHorizontalDrag}
              title="Drag to resize problem & editor"
              className="hidden lg:flex w-1.5 shrink-0 cursor-col-resize items-center justify-center bg-[#462E22]/60 hover:bg-[#CA8A04] transition-colors duration-300"
            >
              <div className="h-8 w-0.5 rounded-full bg-[#BFA98A]/60" />
            </div>
          )}

          {/* Right CodeMirror 6 IDE & Console Drawer */}
          <div
            ref={rightPaneRef}
            className="flex flex-1 flex-col min-w-0 min-h-[380px] lg:min-h-0 overflow-hidden bg-[#110A07]"
          >
            {/* Editor Toolbar — Single Unified Row */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto whitespace-nowrap border-b border-[#462E22] bg-[#1D110B] px-3 py-1.5">
              <div className="flex items-center gap-1.5">
                <select
                  aria-label="Select Language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as LanguageId)}
                  className="rounded-[4px] border border-[#462E22] bg-[#110A07] px-2.5 py-1 font-fira text-xs font-semibold text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none cursor-pointer"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.id} value={lang.id}>
                      {lang.label}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Font Size"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="rounded-[4px] border border-[#462E22] bg-[#110A07] px-2 py-1 font-fira text-xs text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none cursor-pointer"
                >
                  <option value={12}>12px</option>
                  <option value={14}>14px</option>
                  <option value={16}>16px</option>
                  <option value={18}>18px</option>
                </select>

                <button
                  type="button"
                  onClick={() => setWordWrap((v) => !v)}
                  className={`rounded-[4px] border px-2.5 py-1 font-cinzel text-[11px] font-medium cursor-pointer transition-colors duration-200 ${
                    wordWrap
                      ? "border-[#CA8A04] bg-[#2A1810] text-[#CA8A04]"
                      : "border-[#462E22] bg-[#110A07] text-[#BFA98A] hover:border-[#CA8A04]/60 hover:text-[#F5E6D3]"
                  }`}
                >
                  Wrap
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setEditorTheme((t) => (t === "dark" ? "light" : "dark"))
                  }
                  className="inline-flex items-center gap-1 rounded-[4px] border border-[#462E22] bg-[#110A07] px-2.5 py-1 font-cinzel text-[11px] font-medium text-[#BFA98A] hover:border-[#CA8A04]/60 hover:text-[#F5E6D3] transition-colors duration-200 cursor-pointer"
                >
                  {editorTheme === "dark" ? (
                    <>
                      <Sun className="h-3 w-3 text-[#CA8A04]" /> Parchment
                    </>
                  ) : (
                    <>
                      <Moon className="h-3 w-3 text-[#CA8A04]" /> Obsidian
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {isModerator && activeQ.sampleSolutions?.[language] && (
                  <button
                    type="button"
                    onClick={handleLoadSampleSolution}
                    className="rounded-[4px] border border-[#CA8A04]/50 bg-[#2A1810] px-2.5 py-1 font-cinzel text-[11px] font-semibold text-[#CA8A04] hover:border-[#DAA520] hover:bg-[#462E22]/50 transition-colors duration-200 cursor-pointer"
                  >
                    Load Sample
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleResetStub}
                  className="inline-flex items-center gap-1 rounded-[4px] border border-[#462E22] bg-[#110A07] px-2.5 py-1 font-cinzel text-[11px] font-medium text-[#BFA98A] hover:border-[#CA8A04]/60 hover:text-[#F5E6D3] transition-colors duration-200 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </button>
              </div>
            </div>

            {/* Collapsible DSL Head */}
            {activeQ.useDslStubs && stub.head && (
              <div className="border-b border-[#462E22] bg-[#160C08]">
                <button
                  type="button"
                  onClick={() => setShowHead((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-1.5 font-fira text-[11px] text-[#BFA98A] hover:text-[#F5E6D3] cursor-pointer"
                >
                  <span>
                    {showHead ? "▾" : "▸"} Head (Generated Imports & Includes)
                  </span>
                  <span className="text-[10px] text-[#BFA98A]/70">
                    {stub.head.split("\n").length} lines
                  </span>
                </button>
                {showHead && (
                  <pre className="border-t border-[#462E22] bg-[#110A07] px-4 py-2 font-fira text-xs text-[#BFA98A] overflow-x-auto">
                    {stub.head}
                  </pre>
                )}
              </div>
            )}

            {/* CodeMirror 6 Editor */}
            <div className="relative min-h-[140px] flex-1 overflow-hidden">
              <div className="absolute inset-0">
                <CodeEditor
                  language={language}
                  value={currentCode}
                  onChange={setCurrentCode}
                  themeMode={editorTheme}
                  fontSize={fontSize}
                  wordWrap={wordWrap}
                  extraSymbols={extraSymbols}
                  onRunShortcut={() => executeCode("run")}
                />
              </div>
            </div>

            {/* Collapsible DSL Tail */}
            {activeQ.useDslStubs && stub.tail && (
              <div className="border-t border-[#462E22] bg-[#160C08]">
                <button
                  type="button"
                  onClick={() => setShowTail((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-1.5 font-fira text-[11px] text-[#BFA98A] hover:text-[#F5E6D3] cursor-pointer"
                >
                  <span>
                    {showTail ? "▾" : "▸"} Tail (Generated STDIN / INVOKE / STDOUT Driver)
                  </span>
                  <span className="text-[10px] text-[#BFA98A]/70">
                    {stub.tail.split("\n").length} lines
                  </span>
                </button>
                {showTail && (
                  <pre className="max-h-48 overflow-auto border-t border-[#462E22] bg-[#110A07] px-4 py-2 font-fira text-xs text-[#BFA98A]">
                    {stub.tail}
                  </pre>
                )}
              </div>
            )}

            {/* Draggable Vertical Console Splitter */}
            <div
              onMouseDown={startVerticalDrag}
              title="Drag to resize console drawer"
              className="h-1.5 shrink-0 cursor-row-resize bg-[#462E22]/60 hover:bg-[#CA8A04] transition-colors duration-300 flex items-center justify-center"
            >
              <div className="w-10 h-0.5 rounded-full bg-[#BFA98A]/60" />
            </div>

            {/* Bottom Console Drawer */}
            {!consoleCollapsed && (
              <div
                style={{ height: `${consoleHeightPx}px` }}
                className="flex shrink-0 flex-col bg-[#1D110B] overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-[#462E22] bg-[#110A07] px-4 py-1.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDrawerTab("testcase")}
                      className={`rounded-[4px] px-3 py-1 font-cinzel text-xs font-semibold uppercase tracking-[0.5px] transition-colors duration-300 cursor-pointer ${
                        drawerTab === "testcase"
                          ? "border border-[#CA8A04]/50 bg-[#2A1810] text-[#F5E6D3]"
                          : "text-[#BFA98A] hover:text-[#F5E6D3]"
                      }`}
                    >
                      Sample & Custom Input
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrawerTab("result")}
                      className={`rounded-[4px] px-3 py-1 font-cinzel text-xs font-semibold uppercase tracking-[0.5px] transition-colors duration-300 cursor-pointer flex items-center gap-2 ${
                        drawerTab === "result"
                          ? "border border-[#CA8A04]/50 bg-[#2A1810] text-[#F5E6D3]"
                          : "text-[#BFA98A] hover:text-[#F5E6D3]"
                      }`}
                    >
                      Output Console
                      {consoleRes && (
                        <span
                          className={`rounded-[2px] border px-1.5 py-0.5 font-cinzel text-[10px] font-bold uppercase ${getStatusBadgeStyle(
                            consoleRes.status
                          )}`}
                        >
                          {consoleRes.status}
                        </span>
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setConsoleCollapsed(true)}
                    className="inline-flex items-center gap-1 font-cinzel text-[11px] uppercase tracking-[0.5px] text-[#BFA98A] hover:text-[#F5E6D3] cursor-pointer"
                  >
                    Minimize <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {drawerTab === "testcase" ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {sampleCases.map((tc, idx) => (
                            <button
                              key={tc.id}
                              type="button"
                              onClick={() => {
                                setUseCustomInput(false);
                                setSelectedSampleIdx(idx);
                              }}
                              className={`rounded-[2px] border px-2.5 py-1 font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] cursor-pointer transition-colors duration-300 ${
                                !useCustomInput && selectedSampleIdx === idx
                                  ? "border-[#CA8A04] bg-[#2A1810] text-[#CA8A04]"
                                  : "border-[#462E22] bg-[#110A07] text-[#BFA98A] hover:border-[#CA8A04]/60 hover:text-[#F5E6D3]"
                              }`}
                            >
                              Sample {idx + 1}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setUseCustomInput(true)}
                            className={`rounded-[2px] border px-2.5 py-1 font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] cursor-pointer transition-colors duration-300 ${
                              useCustomInput
                                ? "border-[#CA8A04] bg-[#2A1810] text-[#CA8A04]"
                                : "border-[#462E22] bg-[#110A07] text-[#BFA98A] hover:border-[#CA8A04]/60 hover:text-[#F5E6D3]"
                            }`}
                          >
                            Custom Input
                          </button>
                        </div>
                        <span className="font-fira text-[11px] text-[#BFA98A]/70">
                          Ctrl/Cmd + Enter to Run
                        </span>
                      </div>

                      {useCustomInput ? (
                        <textarea
                          rows={4}
                          value={customInput}
                          onChange={(e) => setCustomInput(e.target.value)}
                          placeholder="Enter STDIN input..."
                          className="w-full rounded-[4px] border border-[#462E22] bg-[#110A07] p-3 font-fira text-xs text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
                        />
                      ) : sampleCases[selectedSampleIdx] ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <div className="font-cinzel text-[10px] font-bold uppercase tracking-[1px] text-[#BFA98A] mb-1">
                              Input
                            </div>
                            <pre className="rounded-[4px] border border-[#462E22] bg-[#110A07] p-2.5 font-fira text-xs text-[#F5E6D3] overflow-x-auto">
                              {sampleCases[selectedSampleIdx].input.trimEnd()}
                            </pre>
                          </div>
                          <div>
                            <div className="font-cinzel text-[10px] font-bold uppercase tracking-[1px] text-[#BFA98A] mb-1">
                              Expected Output
                            </div>
                            <pre className="rounded-[4px] border border-[#462E22] bg-[#110A07] p-2.5 font-fira text-xs text-[#22C55E] overflow-x-auto">
                              {sampleCases[selectedSampleIdx].expectedOutput.trimEnd()}
                            </pre>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : !consoleRes ? (
                    <div className="flex h-full items-center justify-center font-spectral text-xs text-[#BFA98A]">
                      Click &ldquo;Run&rdquo; to test against samples or &ldquo;Submit&rdquo; to evaluate your solution.
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`rounded-[2px] border px-2.5 py-1 font-cinzel text-xs font-bold uppercase tracking-[0.5px] ${getStatusBadgeStyle(
                              consoleRes.status
                            )}`}
                          >
                            {consoleRes.status}
                          </span>
                          {consoleRes.totalCount !== undefined && (
                            <span className="font-spectral text-xs text-[#F5E6D3]">
                              {consoleRes.passedCount}/{consoleRes.totalCount}{" "}
                              {consoleRes.kind === "run" ? "sample" : "test"} cases passed
                            </span>
                          )}
                          {isModerator && consoleRes.maxScore !== undefined && (
                            <span className="font-fira text-xs text-[#CA8A04]">
                              ({consoleRes.score}/{consoleRes.maxScore} pts)
                            </span>
                          )}
                        </div>
                        <span className="font-fira text-xs text-[#BFA98A]">
                          {consoleRes.executionTimeMs} ms
                        </span>
                      </div>

                      {(consoleRes.error || consoleRes.compileError) && (
                        <pre className="rounded-[4px] border border-[#B91C1C] bg-[#991B1B]/20 p-3 font-fira text-xs text-[#FCA5A5] whitespace-pre-wrap">
                          {consoleRes.compileError || consoleRes.error}
                        </pre>
                      )}

                      {consoleRes.kind === "custom" && (
                        <pre className="rounded-[4px] border border-[#462E22] bg-[#110A07] p-3 font-fira text-xs text-[#22C55E] whitespace-pre-wrap">
                          {consoleRes.output || "(empty output)"}
                        </pre>
                      )}

                      {consoleRes.testCaseResults &&
                        consoleRes.testCaseResults.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-1.5">
                              {consoleRes.testCaseResults.map((tc, i) => {
                                const label = tc.isSample
                                  ? `Sample ${i + 1}`
                                  : `Hidden ${i + 1}`;
                                return (
                                  <button
                                    key={tc.testCaseId}
                                    type="button"
                                    onClick={() => setSelectedResultCaseIdx(i)}
                                    className={`inline-flex items-center gap-1.5 rounded-[2px] border px-2.5 py-1 font-cinzel text-[11px] font-semibold cursor-pointer transition-colors duration-300 ${
                                      selectedResultCaseIdx === i
                                        ? "ring-1 ring-[#CA8A04]"
                                        : ""
                                    } ${getStatusBadgeStyle(
                                      tc.passed ? "Accepted" : tc.status
                                    )}`}
                                  >
                                    {!tc.isSample && <Lock className="h-3 w-3 opacity-80" />}
                                    <span>
                                      {tc.passed ? "✓" : "✗"} {label} ·{" "}
                                      {formatCaseStatusLabel(tc)}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>

                            {activeResultCase &&
                              (activeResultCase.isSample ? (
                                <div className="rounded-[4px] border border-[#462E22] bg-[#110A07] p-3 text-xs space-y-2">
                                  <div className="grid gap-2 sm:grid-cols-3 font-fira text-[11px]">
                                    <div>
                                      <span className="font-cinzel text-[10px] uppercase text-[#BFA98A]">
                                        Input:
                                      </span>
                                      <pre className="mt-1 rounded-[4px] border border-[#462E22] bg-[#1D110B] p-2 text-[#F5E6D3] overflow-x-auto">
                                        {activeResultCase.input?.trimEnd()}
                                      </pre>
                                    </div>
                                    <div>
                                      <span className="font-cinzel text-[10px] uppercase text-[#BFA98A]">
                                        Expected:
                                      </span>
                                      <pre className="mt-1 rounded-[4px] border border-[#462E22] bg-[#1D110B] p-2 text-[#22C55E] overflow-x-auto">
                                        {activeResultCase.expectedOutput?.trimEnd()}
                                      </pre>
                                    </div>
                                    <div>
                                      <span className="font-cinzel text-[10px] uppercase text-[#BFA98A]">
                                        Your Output:
                                      </span>
                                      <pre className="mt-1 rounded-[4px] border border-[#462E22] bg-[#1D110B] p-2 text-[#F5E6D3] overflow-x-auto">
                                        {activeResultCase.actualOutput?.trimEnd() ||
                                          "(empty)"}
                                      </pre>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="rounded-[4px] border border-[#462E22] border-l-2 border-l-[#CA8A04] bg-[#110A07] p-4 flex flex-wrap items-center justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] border ${getStatusBadgeStyle(
                                        activeResultCase.passed
                                          ? "Accepted"
                                          : activeResultCase.status
                                      )}`}
                                    >
                                      {activeResultCase.passed ? (
                                        <CheckCircle2 className="h-4 w-4" />
                                      ) : activeResultCase.status ===
                                        "Time Limit Exceeded" ? (
                                        <AlertTriangle className="h-4 w-4" />
                                      ) : (
                                        <XCircle className="h-4 w-4" />
                                      )}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-cinzel text-xs font-bold text-[#F5E6D3]">
                                          Hidden Test Case #{selectedResultCaseIdx + 1}
                                        </span>
                                        <span
                                          className={`rounded-[2px] border px-2 py-0.5 font-cinzel text-[10px] font-bold uppercase ${getStatusBadgeStyle(
                                            activeResultCase.passed
                                              ? "Accepted"
                                              : activeResultCase.status
                                          )}`}
                                        >
                                          {formatCaseStatusLabel(activeResultCase)}
                                        </span>
                                      </div>
                                      <p className="font-spectral text-xs text-[#BFA98A] mt-0.5">
                                        Input and expected output are hidden during assessment.
                                      </p>
                                    </div>
                                  </div>
                                  <span className="font-fira text-xs text-[#BFA98A]">
                                    {activeResultCase.executionTimeMs} ms
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {/* Console expand bar when collapsed */}
            {consoleCollapsed && (
              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#462E22] bg-[#1D110B] px-4 py-1.5">
                <button
                  type="button"
                  onClick={() => setConsoleCollapsed(false)}
                  className="inline-flex items-center gap-1 font-cinzel text-xs font-medium text-[#BFA98A] hover:text-[#CA8A04] cursor-pointer"
                >
                  <ChevronUp className="h-3.5 w-3.5" /> Open Console & Testcases
                </button>
                <span className="font-fira text-[11px] text-[#BFA98A]/70">
                  Ctrl/Cmd + Enter to run
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
