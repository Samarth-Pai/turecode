import crypto from "node:crypto";
import { connection, NextResponse } from "next/server";
import { compileDslToStubs } from "@/lib/dsl";
import { mutateDb, readDb } from "@/lib/db";
import type {
  CodeStubBundle,
  CodingQuestion,
  CodingTestCase,
  LanguageId,
  MCQOption,
  MCQQuestion,
} from "@/lib/types";

interface IncomingMcqPayload {
  id?: string;
  prompt?: string;
  options?: MCQOption[];
  correctOptionId?: string;
  points?: number;
  negativePoints?: number;
  difficulty?: "Easy" | "Medium" | "Hard";
  explanation?: string;
  sectionName?: string;
  tags?: string[];
}

export async function GET() {
  await connection();
  const db = await readDb();
  return NextResponse.json({ questions: db.questions });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const kind = body.kind === "coding" ? "coding" : "mcq";

    if (kind === "mcq") {
      const items: IncomingMcqPayload[] = Array.isArray(body.questions)
        ? body.questions
        : [body];

      if (items.length === 0) {
        return NextResponse.json(
          { error: "At least one MCQ question is required." },
          { status: 400 }
        );
      }

      const sectionId =
        typeof body.sectionId === "string" ? body.sectionId.trim() : "";
      const newSectionTitle =
        typeof body.newSectionTitle === "string" ? body.newSectionTitle.trim() : "";

      const normalizedMcqs: MCQQuestion[] = [];
      for (const item of items) {
        const prompt = String(item.prompt ?? "").trim();
        const options: MCQOption[] = Array.isArray(item.options) ? item.options : [];
        const correctOptionId = String(item.correctOptionId ?? "");

        if (!prompt || options.length < 2 || !correctOptionId) {
          return NextResponse.json(
            { error: "Each MCQ requires a prompt, at least 2 options, and correctOptionId." },
            { status: 400 }
          );
        }

        normalizedMcqs.push({
          id: item.id ? String(item.id) : `mcq-${crypto.randomUUID().slice(0, 8)}`,
          kind: "mcq",
          sectionName:
            typeof item.sectionName === "string" && item.sectionName.trim()
              ? item.sectionName.trim()
              : newSectionTitle || undefined,
          prompt,
          options: options.map((o, idx) => ({
            id: String(o.id || String.fromCharCode(97 + idx)),
            text: String(o.text ?? "").trim(),
          })),
          correctOptionId,
          points: Number(item.points) || 25,
          negativePoints: Number(item.negativePoints) || 0,
          difficulty:
            item.difficulty === "Hard"
              ? "Hard"
              : item.difficulty === "Medium"
              ? "Medium"
              : "Easy",
          explanation:
            typeof item.explanation === "string" && item.explanation.trim()
              ? item.explanation.trim()
              : undefined,
          tags: Array.isArray(item.tags) ? item.tags.map(String) : ["General"],
        });
      }

      const saved = await mutateDb((db) => {
        for (const newMcq of normalizedMcqs) {
          const idx = db.questions.findIndex((q) => q.id === newMcq.id);
          if (idx >= 0) {
            db.questions[idx] = newMcq;
          } else {
            db.questions.push(newMcq);
          }

          if (body.contestId && body.roundId) {
            const contest = db.contests.find((c) => c.id === body.contestId);
            const round = contest?.rounds.find((r) => r.id === body.roundId);
            if (round && round.type === "mcq") {
              if (!round.sections) round.sections = [];

              let targetSection = sectionId
                ? round.sections.find((s) => s.id === sectionId)
                : undefined;

              if (!targetSection && newSectionTitle) {
                targetSection = {
                  id: `sec-${crypto.randomUUID().slice(0, 8)}`,
                  title: newSectionTitle,
                  questionIds: [],
                };
                round.sections.push(targetSection);
              } else if (!targetSection && round.sections.length === 0) {
                targetSection = {
                  id: `sec-${crypto.randomUUID().slice(0, 8)}`,
                  title: "Section A: General",
                  questionIds: [...round.questionIds],
                };
                round.sections.push(targetSection);
              } else if (!targetSection) {
                targetSection = round.sections[0];
              }

              newMcq.sectionName = targetSection.title;
              if (!targetSection.questionIds.includes(newMcq.id)) {
                targetSection.questionIds.push(newMcq.id);
              }
              if (!round.questionIds.includes(newMcq.id)) {
                round.questionIds.push(newMcq.id);
              }
            }
          }
        }
        return normalizedMcqs;
      });

      return NextResponse.json(
        { question: saved[0], questions: saved },
        { status: 201 }
      );
    }

    // Coding question creation
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    const useDslStubs = body.useDslStubs !== false;
    const dslSource = String(body.dslSource ?? "").trim();

    if (!title || !description) {
      return NextResponse.json(
        { error: "Coding question requires title and description" },
        { status: 400 }
      );
    }

    let codeStubs: Record<LanguageId, CodeStubBundle>;
    if (useDslStubs) {
      if (!dslSource) {
        return NextResponse.json(
          { error: "DSL source is required when DSL Code Stubs are enabled" },
          { status: 400 }
        );
      }
      const compiled = compileDslToStubs(dslSource);
      if (!compiled.valid) {
        return NextResponse.json(
          { error: `DSL Compilation Error: ${compiled.errors.join("; ")}` },
          { status: 400 }
        );
      }
      codeStubs = body.codeStubs
        ? (body.codeStubs as Record<LanguageId, CodeStubBundle>)
        : compiled.stubs;
    } else {
      codeStubs = body.codeStubs as Record<LanguageId, CodeStubBundle>;
    }

    const rawTestCases: Partial<CodingTestCase>[] = Array.isArray(body.testCases)
      ? body.testCases
      : [];
    if (rawTestCases.length === 0) {
      return NextResponse.json(
        { error: "At least one test case is required" },
        { status: 400 }
      );
    }

    const testCases: CodingTestCase[] = rawTestCases.map((tc, idx) => ({
      id: tc.id ? String(tc.id) : `tc-${crypto.randomUUID().slice(0, 6)}-${idx + 1}`,
      input: String(tc.input ?? ""),
      expectedOutput: String(tc.expectedOutput ?? ""),
      isSample: Boolean(tc.isSample),
      points: Number(tc.points) || 25,
      explanation:
        typeof tc.explanation === "string" && tc.explanation.trim()
          ? tc.explanation.trim()
          : undefined,
    }));

    const totalPoints = testCases.reduce((sum, tc) => sum + tc.points, 0);

    const newCoding: CodingQuestion = {
      id: body.id ? String(body.id) : `code-${crypto.randomUUID().slice(0, 8)}`,
      kind: "coding",
      title,
      difficulty:
        body.difficulty === "Hard"
          ? "Hard"
          : body.difficulty === "Medium"
          ? "Medium"
          : "Easy",
      points: Number(body.points) || totalPoints,
      description,
      inputFormat: String(
        body.inputFormat ?? "Standard input as specified by the DSL schema."
      ),
      constraints: String(
        body.constraints ?? "Standard competitive programming limits."
      ),
      outputFormat: String(
        body.outputFormat ?? "Return the required value from the function stub."
      ),
      tags: Array.isArray(body.tags) ? body.tags.map(String) : ["Algorithms"],
      useDslStubs,
      dslSource,
      codeStubs,
      sampleSolutions: body.sampleSolutions,
      testCases,
    };

    const saved = await mutateDb((db) => {
      const idx = db.questions.findIndex((q) => q.id === newCoding.id);
      if (idx >= 0) {
        db.questions[idx] = newCoding;
      } else {
        db.questions.push(newCoding);
      }

      if (body.contestId && body.roundId) {
        const contest = db.contests.find((c) => c.id === body.contestId);
        const round = contest?.rounds.find((r) => r.id === body.roundId);
        if (round && round.type === "coding" && !round.questionIds.includes(newCoding.id)) {
          round.questionIds.push(newCoding.id);
        }
      }
      return newCoding;
    });

    return NextResponse.json({ question: saved }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save question" },
      { status: 500 }
    );
  }
}
