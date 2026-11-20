"use client";

import React, { useState } from "react";
import { compileDslToStubs, DSL_PRESETS, type DslCompileResult } from "@/lib/dsl";
import {
  SUPPORTED_LANGUAGES,
  type CodeStubBundle,
  type CodingTestCase,
  type LanguageId,
} from "@/lib/types";

interface DslQuestionStudioProps {
  defaultContestId?: string;
  defaultRoundId?: string;
  onCreated?: (questionId: string) => void;
}

export function DslQuestionStudio({
  defaultContestId,
  defaultRoundId,
  onCreated,
}: DslQuestionStudioProps) {
  const [title, setTitle] = useState("Two Sum Pair Check");
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">("Easy");
  const [description, setDescription] = useState(
    "Given an array of integers and a target integer, solve the problem inside the generated function stub."
  );
  const [inputFormat, setInputFormat] = useState(
    "First line: n (array size). Second line: n space-separated integers."
  );
  const [constraints, setConstraints] = useState("1 <= n <= 10^5\n-10^9 <= arr[i] <= 10^9");
  const [outputFormat, setOutputFormat] = useState(
    "Return the required integer result from your function."
  );
  const [tagsText, setTagsText] = useState("Arrays, DSL");

  const [useDslStubs, setUseDslStubs] = useState(true);
  const [dslSource, setDslSource] = useState(DSL_PRESETS[0].dsl);
  const [initialCompiled] = useState<DslCompileResult>(() =>
    compileDslToStubs(DSL_PRESETS[0].dsl)
  );
  const [compileResult, setCompileResult] = useState<DslCompileResult | null>(
    initialCompiled
  );
  const [stubs, setStubs] = useState<Record<LanguageId, CodeStubBundle>>(
    initialCompiled.stubs
  );
  const [previewLang, setPreviewLang] = useState<LanguageId>("cpp");
  const [compiling, setCompiling] = useState(false);

  const [testCases, setTestCases] = useState<CodingTestCase[]>([
    {
      id: "tc-new-1",
      input: "5\n1 2 3 4 5\n",
      expectedOutput: "15",
      isSample: true,
      points: 50,
      explanation: "Sum of elements 1 + 2 + 3 + 4 + 5 = 15.",
    },
    {
      id: "tc-new-2",
      input: "3\n10 20 30\n",
      expectedOutput: "60",
      isSample: false,
      points: 50,
    },
  ]);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const runCompileDsl = async (src: string) => {
    setCompiling(true);
    try {
      const res = await fetch("/api/dsl/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dslSource: src }),
      });
      const data = (await res.json()) as DslCompileResult;
      setCompileResult(data);
      if (data.valid && data.stubs) {
        setStubs(data.stubs);
      }
    } finally {
      setCompiling(false);
    }
  };

  const appendDslSnippet = (snippet: string) => {
    setDslSource((prev) => (prev.trimEnd() ? `${prev.trimEnd()}\n${snippet}` : snippet));
  };

  const handleStubEdit = (field: keyof CodeStubBundle, value: string) => {
    setStubs((prev) => ({
      ...prev,
      [previewLang]: {
        ...prev[previewLang],
        [field]: value,
      },
    }));
  };

  const addTestCase = () => {
    setTestCases((prev) => [
      ...prev,
      {
        id: `tc-new-${Date.now()}`,
        input: "",
        expectedOutput: "",
        isSample: false,
        points: 25,
        explanation: "",
      },
    ]);
  };

  const removeTestCase = (id: string) => {
    setTestCases((prev) => prev.filter((tc) => tc.id !== id));
  };

  const updateTestCase = (id: string, patch: Partial<CodingTestCase>) => {
    setTestCases((prev) =>
      prev.map((tc) => (tc.id === id ? { ...tc, ...patch } : tc))
    );
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMessage(null);
    if (useDslStubs && compileResult && !compileResult.valid) {
      setSaveMessage({
        type: "err",
        text: "Fix DSL syntax errors and regenerate stubs before saving.",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "coding",
          title,
          difficulty,
          description,
          inputFormat,
          constraints,
          outputFormat,
          tags: tagsText
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          useDslStubs,
          dslSource,
          codeStubs: stubs,
          testCases,
          contestId: defaultContestId || undefined,
          roundId: defaultRoundId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMessage({ type: "err", text: data.error || "Failed to save question" });
        return;
      }
      setSaveMessage({
        type: "ok",
        text: `Saved "${data.question.title}" with C, C++, Java & Python DSL code stubs!`,
      });
      onCreated?.(data.question.id);
    } finally {
      setSaving(false);
    }
  };

  const activeStub = stubs[previewLang] ?? { head: "", body: "", tail: "" };

  return (
    <form onSubmit={handleSaveQuestion} className="space-y-6 font-spectral text-[#F5E6D3]">
      {/* Problem Details */}
      <div className="rounded-[4px] border border-[#462E22] border-t-2 border-t-[#CA8A04] bg-[#1D110B] p-6 space-y-4 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#462E22] pb-3">
          <div>
            <h3 className="font-cinzel text-base font-bold text-[#F5E6D3]">
              Coding Problem & HackerRank DSL Stub Authoring
            </h3>
            <p className="font-spectral text-xs text-[#BFA98A]">
              Define problem details, generate C/C++/Java/Python DSL stubs, and add sample test case explanations.
            </p>
          </div>

          <label className="flex items-center gap-2 rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-1.5 font-cinzel text-xs font-semibold text-[#F5E6D3] cursor-pointer">
            <input
              type="checkbox"
              checked={useDslStubs}
              onChange={(e) => setUseDslStubs(e.target.checked)}
              className="accent-[#CA8A04]"
            />
            Enable DSL Code Stubs
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
              Question Title
            </label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-2 text-sm text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
              Difficulty
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as "Easy" | "Medium" | "Hard")}
              className="w-full rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-2 text-sm text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          <div>
            <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
              Tags (comma separated)
            </label>
            <input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              className="w-full rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-2 text-sm text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
            Problem Statement
          </label>
          <textarea
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-2 text-sm text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
              Input Format
            </label>
            <textarea
              rows={2}
              value={inputFormat}
              onChange={(e) => setInputFormat(e.target.value)}
              className="w-full rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-2 text-xs text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
              Constraints
            </label>
            <textarea
              rows={2}
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              className="w-full rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-2 font-fira text-xs text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
              Output Format
            </label>
            <textarea
              rows={2}
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              className="w-full rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-2 text-xs text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* DSL Code Stub Generator */}
      <div className="rounded-[4px] border border-[#581C87] bg-[#1D110B] p-6 space-y-4 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#462E22] pb-3">
          <div>
            <h4 className="font-cinzel text-sm font-bold text-[#F5E6D3] flex items-center gap-2">
              <span className="rounded-[2px] border border-[#581C87] bg-[#581C87]/35 px-2 py-0.5 font-fira text-[10px] font-bold uppercase tracking-[1px] text-[#F5E6D3]">
                DSL
              </span>
              HackerRank Code Stubs Generator (C, C++, Java, Python)
            </h4>
            <p className="font-spectral text-xs text-[#BFA98A] mt-0.5">
              Supports <code className="font-fira text-[#CA8A04]">function(...)</code>,{" "}
              <code className="font-fira text-[#CA8A04]">integer(n)</code>,{" "}
              <code className="font-fira text-[#CA8A04]">Array(...)</code>,{" "}
              <code className="font-fira text-[#CA8A04]">2DArray(...)</code>,{" "}
              <code className="font-fira text-[#CA8A04]">loop(t)...endloop</code>,{" "}
              <code className="font-fira text-[#CA8A04]">INVOKE(...)</code>, and{" "}
              <code className="font-fira text-[#CA8A04]">print(...)</code>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Load DSL Preset"
              onChange={(e) => {
                const preset = DSL_PRESETS.find((p) => p.id === e.target.value);
                if (preset) {
                  setDslSource(preset.dsl);
                  runCompileDsl(preset.dsl);
                }
              }}
              defaultValue=""
              className="rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-1.5 font-spectral text-xs text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
            >
              <option value="" disabled>
                Load DSL Preset Template...
              </option>
              {DSL_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => runCompileDsl(dslSource)}
              disabled={compiling}
              className="rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-3.5 py-1.5 font-cinzel text-xs font-bold uppercase tracking-[0.5px] text-[#110A07] hover:bg-[#B8780A] disabled:opacity-60 transition-colors duration-300 cursor-pointer"
            >
              {compiling ? "Generating..." : "Generate Code Stubs"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { label: "+ function", code: "function(integer, solve, integer n)" },
                { label: "+ integer(n)", code: "integer(n)" },
                { label: "+ Array", code: "Array(integer, arr, n, single)" },
                { label: "+ 2DArray", code: "2DArray(integer, grid, n, m)" },
                { label: "+ loop(t)", code: "loop(t)\n    integer(n)\nendloop" },
                { label: "+ INVOKE", code: "INVOKE(integer, result, solve, n)" },
                { label: "+ print", code: "print(integer, result)" },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => appendDslSnippet(btn.code)}
                  className="rounded-[2px] border border-[#462E22] bg-[#110A07] px-2 py-0.5 font-fira text-[11px] text-[#CA8A04] hover:border-[#CA8A04] hover:bg-[#2A1810] transition-colors duration-300 cursor-pointer"
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <textarea
              rows={14}
              value={dslSource}
              onChange={(e) => setDslSource(e.target.value)}
              spellCheck={false}
              className="w-full rounded-[4px] border border-[#462E22] bg-[#110A07] p-3 font-fira text-xs leading-relaxed text-[#22C55E] focus:border-[#CA8A04] focus:outline-none"
            />

            {compileResult && !compileResult.valid && (
              <div className="rounded-[4px] border border-[#B91C1C] bg-[#991B1B]/20 p-3 text-xs text-[#FCA5A5] space-y-1">
                <div className="font-cinzel font-bold">DSL Parse Errors:</div>
                {compileResult.errors.map((err, i) => (
                  <div key={i} className="font-fira">
                    • {err}
                  </div>
                ))}
              </div>
            )}

            {compileResult && compileResult.valid && (
              <div className="rounded-[4px] border border-[#22C55E]/40 bg-[#22C55E]/10 px-3 py-2 font-spectral text-xs text-[#22C55E]">
                ✓ Compiled <code className="font-fira font-bold">{compileResult.functionDef?.name}</code>{" "}
                stubs for C, C++, Java, and Python.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 rounded-[4px] border border-[#462E22] bg-[#110A07] p-1">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => setPreviewLang(lang.id)}
                    className={`rounded-[2px] px-2.5 py-1 font-fira text-xs font-semibold transition-colors duration-300 cursor-pointer ${
                      previewLang === lang.id
                        ? "bg-[#CA8A04] text-[#110A07]"
                        : "text-[#BFA98A] hover:text-[#F5E6D3]"
                    }`}
                  >
                    {lang.id === "cpp" ? "C++" : lang.id.toUpperCase()}
                  </button>
                ))}
              </div>
              <span className="font-cinzel text-[10px] uppercase tracking-[0.8px] text-[#BFA98A]">
                Editable Head / Body / Tail
              </span>
            </div>

            <div className="space-y-2 rounded-[4px] border border-[#462E22] bg-[#110A07] p-3">
              <div>
                <div className="font-cinzel text-[10px] font-bold uppercase tracking-[1px] text-[#BFA98A] mb-1">
                  Head (Imports / Includes)
                </div>
                <textarea
                  rows={3}
                  value={activeStub.head}
                  onChange={(e) => handleStubEdit("head", e.target.value)}
                  spellCheck={false}
                  className="w-full rounded-[4px] border border-[#462E22] bg-[#1D110B] p-2 font-fira text-[11px] text-[#BFA98A] focus:border-[#CA8A04] focus:outline-none"
                />
              </div>

              <div>
                <div className="font-cinzel text-[10px] font-bold uppercase tracking-[1px] text-[#22C55E] mb-1">
                  Body (Candidate Function Stub)
                </div>
                <textarea
                  rows={5}
                  value={activeStub.body}
                  onChange={(e) => handleStubEdit("body", e.target.value)}
                  spellCheck={false}
                  className="w-full rounded-[4px] border border-[#22C55E]/40 bg-[#1D110B] p-2 font-fira text-xs text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
                />
              </div>

              <div>
                <div className="font-cinzel text-[10px] font-bold uppercase tracking-[1px] text-[#BFA98A] mb-1">
                  Tail (STDIN / INVOKE / STDOUT Driver)
                </div>
                <textarea
                  rows={6}
                  value={activeStub.tail}
                  onChange={(e) => handleStubEdit("tail", e.target.value)}
                  spellCheck={false}
                  className="w-full rounded-[4px] border border-[#462E22] bg-[#1D110B] p-2 font-fira text-[11px] text-[#BFA98A] focus:border-[#CA8A04] focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Test Cases + Sample Explanation Builder */}
      <div className="rounded-[4px] border border-[#462E22] bg-[#1D110B] p-6 space-y-4 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-cinzel text-sm font-bold text-[#F5E6D3]">
              Test Cases ({testCases.length}) — Total{" "}
              {testCases.reduce((s, tc) => s + Number(tc.points || 0), 0)} pts
            </h4>
            <p className="font-spectral text-xs text-[#BFA98A]">
              Sample test cases (and their explanations) are shown to participants; hidden cases are evaluated privately.
            </p>
          </div>
          <button
            type="button"
            onClick={addTestCase}
            className="rounded-[4px] border border-[#462E22] bg-[#2A1810] px-3.5 py-1.5 font-cinzel text-xs font-semibold uppercase tracking-[0.5px] text-[#F5E6D3] hover:border-[#CA8A04] transition-colors duration-300 cursor-pointer"
          >
            + Add Test Case
          </button>
        </div>

        <div className="space-y-3">
          {testCases.map((tc, idx) => (
            <div
              key={tc.id}
              className="rounded-[4px] border border-[#462E22] bg-[#110A07] p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-fira text-xs font-bold text-[#CA8A04]">
                    Test Case #{idx + 1}
                  </span>
                  <label className="flex items-center gap-1.5 font-spectral text-xs text-[#BFA98A] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tc.isSample}
                      onChange={(e) =>
                        updateTestCase(tc.id, { isSample: e.target.checked })
                      }
                      className="accent-[#CA8A04]"
                    />
                    Sample Case (Visible to Participants)
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 font-cinzel text-[11px] uppercase tracking-[0.5px] text-[#BFA98A]">
                    Points:
                    <input
                      type="number"
                      min={1}
                      value={tc.points}
                      onChange={(e) =>
                        updateTestCase(tc.id, { points: Number(e.target.value) || 0 })
                      }
                      className="w-16 rounded-[4px] border border-[#462E22] bg-[#1D110B] px-2 py-1 font-fira text-xs text-[#F5E6D3]"
                    />
                  </label>
                  {testCases.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTestCase(tc.id)}
                      className="font-cinzel text-[11px] font-semibold text-[#F87171] hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block font-cinzel text-[10px] font-semibold uppercase tracking-[0.8px] text-[#BFA98A] mb-1">
                    STDIN Input
                  </label>
                  <textarea
                    rows={2}
                    value={tc.input}
                    onChange={(e) => updateTestCase(tc.id, { input: e.target.value })}
                    className="w-full rounded-[4px] border border-[#462E22] bg-[#1D110B] p-2 font-fira text-xs text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-cinzel text-[10px] font-semibold uppercase tracking-[0.8px] text-[#BFA98A] mb-1">
                    Expected STDOUT Output
                  </label>
                  <textarea
                    rows={2}
                    value={tc.expectedOutput}
                    onChange={(e) =>
                      updateTestCase(tc.id, { expectedOutput: e.target.value })
                    }
                    className="w-full rounded-[4px] border border-[#462E22] bg-[#1D110B] p-2 font-fira text-xs text-[#22C55E] focus:border-[#CA8A04] focus:outline-none"
                  />
                </div>
              </div>

              {tc.isSample && (
                <div>
                  <label className="block font-cinzel text-[10px] font-semibold uppercase tracking-[0.8px] text-[#CA8A04] mb-1">
                    Sample Test Case Explanation (shown to participants)
                  </label>
                  <textarea
                    rows={2}
                    value={tc.explanation ?? ""}
                    onChange={(e) =>
                      updateTestCase(tc.id, { explanation: e.target.value })
                    }
                    placeholder="Explain how the sample input produces the expected output..."
                    className="w-full rounded-[4px] border border-[#462E22] bg-[#1D110B] p-2 font-spectral text-xs text-[#F5E6D3] placeholder:text-[#BFA98A]/60 focus:border-[#CA8A04] focus:outline-none"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Save Coding Question to Bank */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[4px] border border-[#462E22] bg-[#1D110B] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
        <span className="font-spectral text-xs text-[#BFA98A]">
          Saves this coding problem with C, C++, Java &amp; Python stubs directly to the Question Bank.
        </span>

        <button
          type="submit"
          disabled={saving}
          className="rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-5 py-2.5 font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#110A07] shadow-[0_0_16px_rgba(202,138,4,0.28)] hover:bg-[#B8780A] disabled:opacity-50 transition-all duration-300 cursor-pointer"
        >
          {saving ? "Saving..." : "Save Coding Question to Bank"}
        </button>
      </div>

      {saveMessage && (
        <div
          className={`rounded-[4px] border px-4 py-3 font-spectral text-sm font-medium ${
            saveMessage.type === "ok"
              ? "border-[#22C55E]/40 bg-[#22C55E]/10 text-[#22C55E]"
              : "border-[#B91C1C] bg-[#991B1B]/20 text-[#FCA5A5]"
          }`}
        >
          {saveMessage.text}
        </div>
      )}
    </form>
  );
}
