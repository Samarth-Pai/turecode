"use client";

import { Plus, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { LatexText } from "@/components/LatexText";
import type { MCQQuestion, McqSection } from "@/lib/types";

interface McqQuestionModalProps {
  contestId?: string;
  roundId?: string;
  sections?: McqSection[];
  defaultSectionId?: string;
  defaultSectionTitle?: string;
  editingQuestion?: MCQQuestion;
  onClose: () => void;
  onSaved: () => void;
}

interface DraftMcqItem {
  id: string;
  existingId?: string;
  prompt: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  points: number;
  negativePoints: number;
  difficulty: "Easy" | "Medium" | "Hard";
  explanation: string;
}

function makeEmptyDraft(idx: number): DraftMcqItem {
  return {
    id: `draft-${idx}-${Date.now()}`,
    prompt: "",
    options: [
      { id: "a", text: "" },
      { id: "b", text: "" },
      { id: "c", text: "" },
      { id: "d", text: "" },
    ],
    correctOptionId: "a",
    points: 25,
    negativePoints: 5,
    difficulty: "Easy",
    explanation: "",
  };
}

export function McqQuestionModal({
  contestId,
  roundId,
  sections = [],
  defaultSectionId,
  defaultSectionTitle,
  editingQuestion,
  onClose,
  onSaved,
}: McqQuestionModalProps) {
  const isEditing = Boolean(editingQuestion);
  const resolvedSection =
    sections.find((s) => s.id === defaultSectionId) ?? sections[0];
  const targetSectionId = defaultSectionId || resolvedSection?.id;
  const targetSectionTitle =
    defaultSectionTitle || resolvedSection?.title || "Section A: General";

  const [drafts, setDrafts] = useState<DraftMcqItem[]>(() => {
    if (editingQuestion) {
      return [
        {
          id: editingQuestion.id,
          existingId: editingQuestion.id,
          prompt: editingQuestion.prompt,
          options: editingQuestion.options.map((o) => ({ id: o.id, text: o.text })),
          correctOptionId: editingQuestion.correctOptionId,
          points: editingQuestion.points,
          negativePoints: editingQuestion.negativePoints ?? 0,
          difficulty: editingQuestion.difficulty,
          explanation: editingQuestion.explanation ?? "",
        },
      ];
    }
    return [makeEmptyDraft(1)];
  });
  const [activeDraftIdx, setActiveDraftIdx] = useState(0);
  const [showPreview, setShowPreview] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeDraft = drafts[activeDraftIdx] ?? drafts[0];

  const updateActiveDraft = (patch: Partial<DraftMcqItem>) => {
    setDrafts((prev) =>
      prev.map((d, idx) => (idx === activeDraftIdx ? { ...d, ...patch } : d))
    );
  };

  const handleAddDraft = () => {
    const next = [...drafts, makeEmptyDraft(drafts.length + 1)];
    setDrafts(next);
    setActiveDraftIdx(next.length - 1);
  };

  const handleRemoveDraft = (idx: number) => {
    if (drafts.length <= 1) return;
    const next = drafts.filter((_, i) => i !== idx);
    setDrafts(next);
    setActiveDraftIdx(Math.min(activeDraftIdx, next.length - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      if (!d.prompt.trim()) {
        setError(`Question #${i + 1} is missing a prompt.`);
        setActiveDraftIdx(i);
        return;
      }
      if (d.options.some((o) => !o.text.trim())) {
        setError(`Question #${i + 1} must have all 4 answer options filled.`);
        setActiveDraftIdx(i);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "mcq",
          contestId,
          roundId,
          sectionId: targetSectionId,
          newSectionTitle: targetSectionId ? undefined : targetSectionTitle,
          questions: drafts.map((d) => ({
            ...(d.existingId ? { id: d.existingId } : {}),
            prompt: d.prompt,
            options: d.options,
            correctOptionId: d.correctOptionId,
            points: d.points,
            negativePoints: d.negativePoints,
            difficulty: d.difficulty,
            explanation: d.explanation,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save MCQ set");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#110A07]/85 p-4 backdrop-blur-md">
      <div className="w-full max-w-3xl rounded-[6px] border border-[#462E22] border-t-2 border-t-[#CA8A04] bg-[#1D110B] shadow-[0_12px_40px_rgba(0,0,0,0.65)] overflow-hidden font-spectral text-[#F5E6D3]">
        <div className="flex items-center justify-between border-b border-[#462E22] px-6 py-4">
          <div>
            <h3 className="font-cinzel text-base font-bold text-[#F5E6D3]">
              {isEditing ? "Edit MCQ Question" : "Add MCQ Set"} —{" "}
              <span className="text-[#CA8A04]">{targetSectionTitle}</span>
            </h3>
            <p className="font-spectral text-xs text-[#BFA98A] mt-0.5">
              Supports LaTeX math via <code className="font-fira text-[#CA8A04]">$inline$</code> or{" "}
              <code className="font-fira text-[#CA8A04]">$$display$$</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-cinzel text-xs font-semibold uppercase tracking-[0.5px] text-[#BFA98A] hover:text-[#F5E6D3] cursor-pointer"
          >
            Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Batch / Set Question Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#462E22] pb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {drafts.map((d, idx) => (
                <div key={d.id} className="inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => setActiveDraftIdx(idx)}
                    className={`rounded-[4px] border px-3 py-1 font-fira text-xs font-bold transition-colors cursor-pointer ${
                      idx === activeDraftIdx
                        ? "border-[#DAA520] bg-[#CA8A04] text-[#110A07]"
                        : "border-[#462E22] bg-[#110A07] text-[#BFA98A] hover:border-[#CA8A04]"
                    }`}
                  >
                    Q{idx + 1}
                  </button>
                  {drafts.length > 1 && idx === activeDraftIdx && (
                    <button
                      type="button"
                      onClick={() => handleRemoveDraft(idx)}
                      title="Remove this question from set"
                      className="ml-1 text-[#F87171] hover:text-[#FCA5A5] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {!isEditing && (
                <button
                  type="button"
                  onClick={handleAddDraft}
                  className="inline-flex items-center gap-1 rounded-[4px] border border-[#CA8A04]/60 bg-[#2A1810] px-2.5 py-1 font-cinzel text-[11px] font-semibold text-[#CA8A04] hover:border-[#DAA520] cursor-pointer"
                >
                  <Plus className="h-3 w-3" /> Add Another MCQ to Set
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#CA8A04] hover:underline cursor-pointer"
            >
              {showPreview ? "Hide LaTeX Preview" : "Show LaTeX Preview"}
            </button>
          </div>

          {/* Active Draft Fields */}
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
                  Difficulty
                </label>
                <select
                  value={activeDraft.difficulty}
                  onChange={(e) =>
                    updateActiveDraft({
                      difficulty: e.target.value as "Easy" | "Medium" | "Hard",
                    })
                  }
                  className="w-full rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-2 text-sm text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
                  Points
                </label>
                <input
                  type="number"
                  min={1}
                  value={activeDraft.points}
                  onChange={(e) =>
                    updateActiveDraft({ points: Number(e.target.value) || 25 })
                  }
                  className="w-full rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-2 font-fira text-sm text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
                  Negative Penalty
                </label>
                <input
                  type="number"
                  min={0}
                  value={activeDraft.negativePoints}
                  onChange={(e) =>
                    updateActiveDraft({ negativePoints: Number(e.target.value) || 0 })
                  }
                  className="w-full rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-2 font-fira text-sm text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
                Question Prompt (LaTeX Supported)
              </label>
              <textarea
                required
                rows={3}
                value={activeDraft.prompt}
                onChange={(e) => updateActiveDraft({ prompt: e.target.value })}
                placeholder="e.g., Evaluate $\sum_{k=1}^{n} k^2$ or find the recurrence solution $T(n) = 2T(n/2) + n$..."
                className="w-full rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-2 text-sm text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A]">
                Answer Choices (select correct option; LaTeX `$...$` supported)
              </label>
              {activeDraft.options.map((opt, idx) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correctOption"
                    checked={activeDraft.correctOptionId === opt.id}
                    onChange={() => updateActiveDraft({ correctOptionId: opt.id })}
                    className="accent-[#CA8A04] cursor-pointer"
                  />
                  <span className="w-6 font-fira text-xs font-bold uppercase text-[#CA8A04]">
                    {opt.id}.
                  </span>
                  <input
                    required
                    value={opt.text}
                    onChange={(e) => {
                      const nextOpts = activeDraft.options.map((o, i) =>
                        i === idx ? { ...o, text: e.target.value } : o
                      );
                      updateActiveDraft({ options: nextOpts });
                    }}
                    placeholder={`Option ${opt.id.toUpperCase()} (e.g. $O(n \\log n)$)`}
                    className="flex-1 rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-1.5 text-sm text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
                Explanation (optional)
              </label>
              <input
                value={activeDraft.explanation}
                onChange={(e) => updateActiveDraft({ explanation: e.target.value })}
                placeholder="Moderator reference explanation (LaTeX supported)"
                className="w-full rounded-[4px] border border-[#462E22] bg-[#110A07] px-3 py-2 text-sm text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
              />
            </div>

            {showPreview && (activeDraft.prompt.trim() || activeDraft.options.some((o) => o.text.trim())) && (
              <div className="rounded-[4px] border border-[#462E22] border-l-2 border-l-[#CA8A04] bg-[#160C08] p-4 space-y-2.5">
                <div className="font-cinzel text-[10px] font-bold uppercase tracking-[1px] text-[#CA8A04]">
                  Live LaTeX Preview — Question #{activeDraftIdx + 1}
                </div>
                {activeDraft.prompt.trim() && (
                  <div className="font-spectral text-sm leading-relaxed text-[#F5E6D3] whitespace-pre-line">
                    <LatexText text={activeDraft.prompt} />
                  </div>
                )}
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {activeDraft.options.map(
                    (o) =>
                      o.text.trim() && (
                        <div
                          key={o.id}
                          className={`rounded-[2px] border px-2.5 py-1.5 text-xs ${
                            o.id === activeDraft.correctOptionId
                              ? "border-[#22C55E]/50 bg-[#22C55E]/10 text-[#F5E6D3]"
                              : "border-[#462E22] bg-[#110A07] text-[#BFA98A]"
                          }`}
                        >
                          <strong className="font-fira uppercase text-[#CA8A04] mr-1.5">
                            {o.id}.
                          </strong>
                          <LatexText text={o.text} />
                        </div>
                      )
                  )}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-[4px] border border-[#B91C1C] bg-[#991B1B]/20 px-3 py-2 text-xs text-[#FCA5A5]">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[4px] border border-[#462E22] bg-[#2A1810] px-4 py-2 font-cinzel text-xs font-semibold uppercase tracking-[0.5px] text-[#BFA98A] hover:border-[#CA8A04] hover:text-[#F5E6D3] transition-colors duration-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-4 py-2 font-cinzel text-xs font-bold uppercase tracking-[0.5px] text-[#110A07] hover:bg-[#B8780A] disabled:opacity-50 transition-colors duration-300 cursor-pointer"
            >
              {saving
                ? "Saving..."
                : isEditing
                ? "Save Changes"
                : `Save ${drafts.length} MCQ Question${drafts.length > 1 ? "s" : ""}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
