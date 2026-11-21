import crypto from "node:crypto";
import { connection, NextResponse } from "next/server";
import { mutateDb, readDb } from "@/lib/db";
import { getRoundStatus, type Question, type Round } from "@/lib/types";

function syncQuestionIdsWithSections(round: Round) {
  if (round.type !== "mcq" || !round.sections || round.sections.length === 0) return;
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const sec of round.sections) {
    sec.questionIds = sec.questionIds.filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      ordered.push(id);
      return true;
    });
  }
  for (const id of round.questionIds) {
    if (!seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  round.questionIds = ordered;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ contestId: string; roundId: string }> }
) {
  await connection();
  const { contestId, roundId } = await context.params;
  const db = await readDb();
  const contest = db.contests.find((c) => c.id === contestId);
  if (!contest) {
    return NextResponse.json({ error: "Contest not found" }, { status: 404 });
  }

  const round = contest.rounds.find((r) => r.id === roundId);
  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  const qMap = new Map<string, Question>(db.questions.map((q) => [q.id, q]));
  const questions = round.questionIds
    .map((id) => qMap.get(id))
    .filter((q): q is Question => Boolean(q));

  return NextResponse.json({
    contest: {
      id: contest.id,
      title: contest.title,
      organizerName: contest.organizerName,
      strictMode: Boolean(contest.strictMode),
    },
    round,
    scheduleStatus: getRoundStatus(round),
    serverNow: Date.now(),
    questions,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ contestId: string; roundId: string }> }
) {
  try {
    const { contestId, roundId } = await context.params;
    const body = await request.json();

    const result = await mutateDb((db) => {
      const contest = db.contests.find((c) => c.id === contestId);
      if (!contest) return { error: "Contest not found", status: 404 as const };

      const round = contest.rounds.find((r) => r.id === roundId);
      if (!round) return { error: "Round not found", status: 404 as const };

      if (typeof body.title === "string" && body.title.trim()) {
        round.title = body.title.trim();
      }
      if (typeof body.description === "string") {
        round.description = body.description.trim();
      }
      if (typeof body.durationMinutes === "number" && body.durationMinutes > 0) {
        round.durationMinutes = body.durationMinutes;
      }

      if (body.startTime) {
        round.startTime = new Date(body.startTime).toISOString();
      }
      if (body.endTime) {
        round.endTime = new Date(body.endTime).toISOString();
      }

      if (body.schedulePreset === "start_now") {
        const now = Date.now();
        round.startTime = new Date(now - 60 * 1000).toISOString();
        round.endTime = new Date(now + 24 * 3600 * 1000).toISOString();
      } else if (body.schedulePreset === "upcoming_tomorrow") {
        const now = Date.now();
        round.startTime = new Date(now + 24 * 3600 * 1000).toISOString();
        round.endTime = new Date(now + 48 * 3600 * 1000).toISOString();
      } else if (body.schedulePreset === "end_now") {
        const now = Date.now();
        if (new Date(round.startTime).getTime() > now - 3600 * 1000) {
          round.startTime = new Date(now - 2 * 3600 * 1000).toISOString();
        }
        round.endTime = new Date(now - 60 * 1000).toISOString();
      }

      // Section management for MCQ rounds
      if (body.action === "add_section") {
        const secTitle = String(body.sectionTitle ?? "").trim();
        if (!secTitle) {
          return { error: "Section title is required.", status: 400 as const };
        }
        if (!round.sections) {
          round.sections = [];
          if (round.questionIds.length > 0) {
            round.sections.push({
              id: `sec-${crypto.randomUUID().slice(0, 8)}`,
              title: "Section A: Existing Questions",
              questionIds: [...round.questionIds],
            });
          }
        }
        round.sections.push({
          id: `sec-${crypto.randomUUID().slice(0, 8)}`,
          title: secTitle,
          description:
            typeof body.sectionDescription === "string"
              ? body.sectionDescription.trim()
              : undefined,
          questionIds: [],
        });
        syncQuestionIdsWithSections(round);
      } else if (body.action === "rename_section" && typeof body.sectionId === "string") {
        const sec = round.sections?.find((s) => s.id === body.sectionId);
        if (sec && typeof body.sectionTitle === "string" && body.sectionTitle.trim()) {
          sec.title = body.sectionTitle.trim();
        }
      } else if (body.action === "delete_section" && typeof body.sectionId === "string") {
        const sec = round.sections?.find((s) => s.id === body.sectionId);
        if (sec && round.sections) {
          const removedSet = new Set(sec.questionIds);
          round.sections = round.sections.filter((s) => s.id !== body.sectionId);
          round.questionIds = round.questionIds.filter((id) => !removedSet.has(id));
          syncQuestionIdsWithSections(round);
        }
      } else if (body.action === "add_question" && typeof body.questionId === "string") {
        const q = db.questions.find((item) => item.id === body.questionId);
        if (!q) {
          return { error: "Question not found in bank", status: 404 as const };
        }
        if (q.kind !== round.type) {
          return {
            error: `Cannot add a ${q.kind.toUpperCase()} question to a ${round.type.toUpperCase()} round`,
            status: 400 as const,
          };
        }
        if (round.type === "mcq") {
          if (!round.sections) {
            round.sections = [
              {
                id: `sec-${crypto.randomUUID().slice(0, 8)}`,
                title: "Section A: General",
                questionIds: [...round.questionIds],
              },
            ];
          }
          const targetSection =
            (typeof body.sectionId === "string" &&
              round.sections.find((s) => s.id === body.sectionId)) ||
            round.sections[0];
          if (targetSection && !targetSection.questionIds.includes(q.id)) {
            targetSection.questionIds.push(q.id);
          }
        }
        if (!round.questionIds.includes(q.id)) {
          round.questionIds.push(q.id);
        }
        syncQuestionIdsWithSections(round);
      } else if (body.action === "remove_question" && typeof body.questionId === "string") {
        round.questionIds = round.questionIds.filter((id) => id !== body.questionId);
        if (round.sections) {
          for (const sec of round.sections) {
            sec.questionIds = sec.questionIds.filter((id) => id !== body.questionId);
          }
        }
      } else if (body.action === "reorder_questions" && Array.isArray(body.questionIds)) {
        round.questionIds = body.questionIds.filter(
          (id: unknown): id is string => typeof id === "string"
        );
      }

      return { round, scheduleStatus: getRoundStatus(round), status: 200 as const };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      round: result.round,
      scheduleStatus: result.scheduleStatus,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update round" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ contestId: string; roundId: string }> }
) {
  const { contestId, roundId } = await context.params;
  const deleted = await mutateDb((db) => {
    const contest = db.contests.find((c) => c.id === contestId);
    if (!contest) return false;
    const before = contest.rounds.length;
    contest.rounds = contest.rounds.filter((r) => r.id !== roundId);
    return contest.rounds.length < before;
  });

  if (!deleted) {
    return NextResponse.json({ error: "Contest or round not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
