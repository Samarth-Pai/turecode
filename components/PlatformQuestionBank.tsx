"use client";

import { BookOpen, Code2, Search } from "lucide-react";
import React, { useState } from "react";
import { DslQuestionStudio } from "@/components/DslQuestionStudio";
import type { CodingQuestion, Question } from "@/lib/types";

interface PlatformQuestionBankProps {
  questions: Question[];
  activeContestId?: string;
  defaultRoundId?: string;
  onUpdated: () => void;
}

export function PlatformQuestionBank({
  questions,
  activeContestId,
  defaultRoundId,
  onUpdated,
}: PlatformQuestionBankProps) {
  const [difficultyFilter, setDifficultyFilter] = useState<
    "all" | "Easy" | "Medium" | "Hard"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDslStudio, setShowDslStudio] = useState(Boolean(defaultRoundId));

  const codingQuestions = questions.filter(
    (q): q is CodingQuestion => q.kind === "coding"
  );

  const filteredQuestions = codingQuestions.filter((q) => {
    if (difficultyFilter !== "all" && q.difficulty !== difficultyFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const term = searchQuery.trim().toLowerCase();
      const hay = `${q.title} ${q.description} ${q.tags.join(" ")}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 font-spectral text-[#F5E6D3]">
      {/* Platform Coding Question Bank Header */}
      <div className="rounded-[4px] border border-[#462E22] border-t-2 border-t-[#CA8A04] bg-[#1D110B] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.45)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-cinzel text-base font-bold text-[#F5E6D3] flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[#CA8A04]" />
              Coding Question Bank ({codingQuestions.length} Problems)
            </h3>
            <p className="font-spectral text-xs text-[#BFA98A] mt-0.5">
              Author and browse standalone Coding problems with C, C++, Java &amp; Python DSL stubs.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowDslStudio((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-4 py-2 font-cinzel text-xs font-bold uppercase tracking-[0.5px] text-[#110A07] hover:bg-[#B8780A] cursor-pointer"
          >
            <Code2 className="h-3.5 w-3.5" />
            {showDslStudio
              ? "Hide Coding Problem Studio"
              : "+ Add Coding Question"}
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#462E22] pt-3">
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: "all", label: `All (${codingQuestions.length})` },
                {
                  id: "Easy",
                  label: `Easy (${codingQuestions.filter((q) => q.difficulty === "Easy").length})`,
                },
                {
                  id: "Medium",
                  label: `Medium (${codingQuestions.filter((q) => q.difficulty === "Medium").length})`,
                },
                {
                  id: "Hard",
                  label: `Hard (${codingQuestions.filter((q) => q.difficulty === "Hard").length})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDifficultyFilter(tab.id)}
                className={`rounded-[2px] border px-3 py-1 font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] cursor-pointer ${
                  difficultyFilter === tab.id
                    ? "border-[#DAA520] bg-[#CA8A04] text-[#110A07]"
                    : "border-[#462E22] bg-[#110A07] text-[#BFA98A] hover:text-[#F5E6D3]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#BFA98A]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search coding questions..."
              className="w-full rounded-[4px] border border-[#462E22] bg-[#110A07] pl-8 pr-3 py-1.5 font-spectral text-xs text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
            />
          </div>
        </div>

        {/* Coding Question List */}
        {filteredQuestions.length === 0 ? (
          <div className="rounded-[4px] border border-dashed border-[#462E22] bg-[#110A07] p-6 text-center font-spectral text-xs text-[#BFA98A]">
            No coding questions match your filter.
          </div>
        ) : (
          <div className="divide-y divide-[#462E22] rounded-[4px] border border-[#462E22] bg-[#110A07]">
            {filteredQuestions.map((q, idx) => {
              const sampleCount = q.testCases.filter((tc) => tc.isSample).length;
              const hiddenCount = q.testCases.length - sampleCount;

              return (
                <div
                  key={q.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 hover:bg-[#1D110B]/60 transition-colors"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-fira text-xs font-bold text-[#CA8A04]">
                        #{idx + 1}
                      </span>
                      <span className="font-cinzel text-sm font-bold text-[#F5E6D3]">
                        {q.title}
                      </span>
                      <span className="rounded-[2px] border border-[#462E22] bg-[#1D110B] px-2 py-0.5 font-cinzel text-[10px] font-semibold uppercase text-[#BFA98A]">
                        {q.difficulty}
                      </span>
                      <span className="font-fira text-xs font-semibold text-[#22C55E]">
                        {q.points} pts
                      </span>
                      {q.useDslStubs && (
                        <span className="rounded-[2px] border border-[#CA8A04]/40 bg-[#CA8A04]/10 px-2 py-0.5 font-fira text-[10px] text-[#CA8A04]">
                          DSL Stubs (C/C++/Java/Py)
                        </span>
                      )}
                    </div>

                    <p className="font-spectral text-xs text-[#BFA98A] line-clamp-2 max-w-3xl">
                      {q.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="rounded-[2px] border border-[#462E22] bg-[#1D110B] px-2.5 py-1 font-fira text-[11px] text-[#BFA98A]">
                      {sampleCount} sample / {hiddenCount} hidden test cases
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Collapsible DSL Coding Question Studio */}
      {showDslStudio && (
        <DslQuestionStudio
          defaultContestId={activeContestId}
          defaultRoundId={defaultRoundId}
          onCreated={() => {
            onUpdated();
          }}
        />
      )}
    </div>
  );
}
