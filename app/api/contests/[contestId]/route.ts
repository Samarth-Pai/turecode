import crypto from "node:crypto";
import { cookies } from "next/headers";
import { connection, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import {
  computeLeaderboard,
  generateJoinCode,
  getSessionData,
  mutateDb,
  readDb,
} from "@/lib/db";
import type { Question, Round } from "@/lib/types";

export async function GET(
  _req: Request,
  context: { params: Promise<{ contestId: string }> }
) {
  await connection();
  const { contestId } = await context.params;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionData(token);
  const isModerator = session.user?.role === "moderator";

  const db = await readDb();
  const contest = db.contests.find((c) => c.id === contestId);
  if (!contest) {
    return NextResponse.json({ error: "Contest not found" }, { status: 404 });
  }

  const qMap = new Map<string, Question>(db.questions.map((q) => [q.id, q]));
  const populatedRounds = contest.rounds
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((r) => ({
      ...r,
      questions: r.questionIds
        .map((id) => qMap.get(id))
        .filter((q): q is Question => Boolean(q)),
    }));

  const leaderboard = computeLeaderboard(db, contestId);
  const isEnrolled =
    isModerator ||
    (session.user
      ? (contest.enrolledUserIds ?? []).includes(session.user.id)
      : false);

  return NextResponse.json({
    contest: {
      ...contest,
      joinCode: isModerator ? contest.joinCode : "",
      rounds: populatedRounds,
    },
    isEnrolled,
    leaderboard: leaderboard.entries,
    maxPossibleScore: leaderboard.maxPossibleScore,
    questionBank: db.questions,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ contestId: string }> }
) {
  try {
    const { contestId } = await context.params;
    const body = await request.json();

    const updated = await mutateDb((db) => {
      const contest = db.contests.find((c) => c.id === contestId);
      if (!contest) return null;

      if (typeof body.title === "string" && body.title.trim()) {
        contest.title = body.title.trim();
      }
      if (typeof body.description === "string") {
        contest.description = body.description.trim();
      }
      if (typeof body.strictMode === "boolean") {
        contest.strictMode = body.strictMode;
      }

      if (body.action === "regenerate_join_code") {
        let nextCode = generateJoinCode();
        while (db.contests.some((c) => c.id !== contestId && c.joinCode === nextCode)) {
          nextCode = generateJoinCode();
        }
        contest.joinCode = nextCode;
      } else if (typeof body.joinCode === "string" && body.joinCode.trim()) {
        const cleaned = body.joinCode
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9-]/g, "");
        if (cleaned) {
          contest.joinCode = cleaned;
        }
      }

      if (body.action === "add_round") {
        const now = Date.now();
        const roundType = body.type === "coding" ? "coding" : "mcq";
        const nextOrder =
          contest.rounds.reduce((max, r) => Math.max(max, r.order), 0) + 1;

        const newRound: Round = {
          id: `round-${crypto.randomUUID().slice(0, 8)}`,
          contestId,
          title: String(
            body.roundTitle || `Round ${nextOrder}: ${roundType.toUpperCase()}`
          ),
          description: String(body.roundDescription || ""),
          type: roundType,
          order: nextOrder,
          startTime: body.startTime || new Date(now).toISOString(),
          endTime: body.endTime || new Date(now + 24 * 3600 * 1000).toISOString(),
          durationMinutes: Number(body.durationMinutes) || 60,
          questionIds: Array.isArray(body.questionIds) ? body.questionIds : [],
        };
        contest.rounds.push(newRound);
        return { contest, addedRound: newRound };
      }

      return { contest };
    });

    if (!updated) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update contest" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ contestId: string }> }
) {
  const { contestId } = await context.params;
  const removed = await mutateDb((db) => {
    const idx = db.contests.findIndex((c) => c.id === contestId);
    if (idx === -1) return false;
    db.contests.splice(idx, 1);
    return true;
  });

  if (!removed) {
    return NextResponse.json({ error: "Contest not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
