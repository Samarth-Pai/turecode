"use client";

import React, { useState } from "react";

interface McqQuestionModalProps {
  contestId?: string;
  roundId?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function McqQuestionModal({
  contestId,
  roundId,
  onClose,
  onSaved,
}: McqQuestionModalProps) {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState([
    { id: "a", text: "" },
    { id: "b", text: "" },
    { id: "c", text: "" },
    { id: "d", text: "" },
  ]);
  const [correctOptionId, setCorrectOptionId] = useState("a");
  const [points, setPoints] = useState(25);
  const [negativePoints, setNegativePoints] = useState(5);
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">("Easy");
  const [explanation, setExplanation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (options.some((o) => !o.text.trim())) {
      setError("Please fill in all 4 MCQ options.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "mcq",
          title,
          prompt,
          options,
          correctOptionId,
          points,
          negativePoints,
          difficulty,
          explanation,
          contestId,
          roundId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save MCQ");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A0F0A]/85 p-4 backdrop-blur-md">
      <div className="w-full max-w-2xl rounded-[6px] border border-[#5C3D2E] border-t-2 border-t-[#CA8A04] bg-[#2C1A10] shadow-[0_12px_40px_rgba(0,0,0,0.65)] overflow-hidden font-spectral text-[#F5E6D3]">
        <div className="flex items-center justify-between border-b border-[#5C3D2E] px-6 py-4">
          <h3 className="font-cinzel text-base font-bold text-[#F5E6D3]">
            Create New MCQ Question
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="font-cinzel text-xs font-semibold uppercase tracking-[0.5px] text-[#BFA98A] hover:text-[#F5E6D3] cursor-pointer"
          >
            Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
                Question Title
              </label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Dijkstra Complexity"
                className="w-full rounded-[4px] border border-[#5C3D2E] bg-[#1A0F0A] px-3 py-2 text-sm text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
                Points
              </label>
              <input
                type="number"
                min={1}
                value={points}
                onChange={(e) => setPoints(Number(e.target.value) || 25)}
                className="w-full rounded-[4px] border border-[#5C3D2E] bg-[#1A0F0A] px-3 py-2 font-fira text-sm text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
                Negative Penalty
              </label>
              <input
                type="number"
                min={0}
                value={negativePoints}
                onChange={(e) => setNegativePoints(Number(e.target.value) || 0)}
                className="w-full rounded-[4px] border border-[#5C3D2E] bg-[#1A0F0A] px-3 py-2 font-fira text-sm text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
              Question Prompt
            </label>
            <textarea
              required
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Write the multiple-choice question prompt..."
              className="w-full rounded-[4px] border border-[#5C3D2E] bg-[#1A0F0A] px-3 py-2 text-sm text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A]">
              Answer Choices (select the correct option)
            </label>
            {options.map((opt, idx) => (
              <div key={opt.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correctOption"
                  checked={correctOptionId === opt.id}
                  onChange={() => setCorrectOptionId(opt.id)}
                  className="accent-[#CA8A04] cursor-pointer"
                />
                <span className="w-6 font-fira text-xs font-bold uppercase text-[#CA8A04]">
                  {opt.id}.
                </span>
                <input
                  required
                  value={opt.text}
                  onChange={(e) => {
                    const next = [...options];
                    next[idx] = { ...opt, text: e.target.value };
                    setOptions(next);
                  }}
                  placeholder={`Option ${opt.id.toUpperCase()}`}
                  className="flex-1 rounded-[4px] border border-[#5C3D2E] bg-[#1A0F0A] px-3 py-1.5 text-sm text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
                />
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as "Easy" | "Medium" | "Hard")}
                className="w-full rounded-[4px] border border-[#5C3D2E] bg-[#1A0F0A] px-3 py-2 text-sm text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block font-cinzel text-[11px] font-semibold uppercase tracking-[0.5px] text-[#BFA98A] mb-1">
                Explanation (optional)
              </label>
              <input
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Moderator reference note"
                className="w-full rounded-[4px] border border-[#5C3D2E] bg-[#1A0F0A] px-3 py-2 text-sm text-[#F5E6D3] focus:border-[#CA8A04] focus:outline-none"
              />
            </div>
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
              className="rounded-[4px] border border-[#5C3D2E] bg-[#3D2517] px-4 py-2 font-cinzel text-xs font-semibold uppercase tracking-[0.5px] text-[#BFA98A] hover:border-[#CA8A04] hover:text-[#F5E6D3] transition-colors duration-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-4 py-2 font-cinzel text-xs font-bold uppercase tracking-[0.5px] text-[#1A0F0A] hover:bg-[#B8780A] disabled:opacity-50 transition-colors duration-300 cursor-pointer"
            >
              {saving ? "Saving..." : "Create MCQ Question"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
