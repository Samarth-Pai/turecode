import crypto from "node:crypto";
import { connection, NextRequest, NextResponse } from "next/server";
import { computeLeaderboard, mutateDb, readDb } from "@/lib/db";
import { getRoundStatus, type MCQSubmission } from "@/lib/types";

export async function GET(request: NextRequest) {
  await connection();
  const contestId = request.nextUrl.searchParams.get("contestId");
  const roundId = request.nextUrl.searchParams.get("roundId");
  const userId = request.nextUrl.searchParams.get("userId");

  const db = await readDb();
  const userIdParam = request.nextUrl.searchParams.get("userId");
  const reqUser = userIdParam ? db.users.find((u) => u.id === userIdParam) : null;
  const isMod = reqUser?.role === "moderator";

  const filtered = db.mcqSubmissions
    .filter((s) => {
      if (contestId && s.contestId !== contestId) return false;
      if (roundId && s.roundId !== roundId) return false;
      if (userId && s.userId !== userId) return false;
      return true;
    })
    .map((s) =>
      isMod
        ? s
        : {
            id: s.id,
            contestId: s.contestId,
            roundId: s.roundId,
            questionId: s.questionId,
            userId: s.userId,
            selectedOptionId: s.selectedOptionId,
            submittedAt: s.submittedAt,
          }
    );

  return NextResponse.json({ submissions: filtered });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const contestId = String(body.contestId ?? "");
    const roundId = String(body.roundId ?? "");
    const userId = String(body.userId ?? "");
    const answers: { questionId: string; selectedOptionId: string }[] = Array.isArray(body.answers)
      ? body.answers
      : body.questionId && body.selectedOptionId
      ? [{ questionId: String(body.questionId), selectedOptionId: String(body.selectedOptionId) }]
      : [];

    if (!contestId || !roundId || !userId || answers.length === 0) {
      return NextResponse.json(
        { error: "contestId, roundId, userId, and answers are required" },
        { status: 400 }
      );
    }

    const result = await mutateDb((db) => {
      const contest = db.contests.find((c) => c.id === contestId);
      if (!contest) return { error: "Contest not found", status: 404 as const };

      const round = contest.rounds.find((r) => r.id === roundId);
      if (!round) return { error: "Round not found", status: 404 as const };

      const user = db.users.find((u) => u.id === userId);
      const isMod = user?.role === "moderator" || Boolean(body.moderatorOverride);
      const scheduleStatus = getRoundStatus(round);
      if (scheduleStatus !== "ACTIVE" && !isMod) {
        return {
          error: `Round is ${scheduleStatus}. Submissions are only accepted while ACTIVE.`,
          status: 403 as const,
        };
      }

      const now = new Date().toISOString();
      const recorded: MCQSubmission[] = [];

      for (const ans of answers) {
        if (!round.questionIds.includes(ans.questionId)) continue;
        const q = db.questions.find(
          (item) => item.id === ans.questionId && item.kind === "mcq"
        );
        if (!q || q.kind !== "mcq") continue;

        const isCorrect = q.correctOptionId === ans.selectedOptionId;
        const score = isCorrect ? q.points : -q.negativePoints;

        // Replace previous submission for same user + round + question
        db.mcqSubmissions = db.mcqSubmissions.filter(
          (s) =>
            !(
              s.contestId === contestId &&
              s.roundId === roundId &&
              s.questionId === ans.questionId &&
              s.userId === userId
            )
        );

        const sub: MCQSubmission = {
          id: `sub-mcq-${crypto.randomUUID().slice(0, 8)}`,
          contestId,
          roundId,
          questionId: ans.questionId,
          userId,
          selectedOptionId: ans.selectedOptionId,
          isCorrect,
          score,
          submittedAt: now,
        };
        db.mcqSubmissions.push(sub);
        recorded.push(sub);
      }

      const lb = computeLeaderboard(db, contestId, roundId);
      return {
        isMod,
        recorded,
        totalRoundScore: recorded.reduce((acc, s) => acc + s.score, 0),
        correctCount: recorded.filter((s) => s.isCorrect).length,
        leaderboard: lb.entries,
        status: 200 as const,
      };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    if (!result.isMod) {
      return NextResponse.json({
        submitted: true,
        answeredCount: result.recorded.length,
        recorded: result.recorded.map((s) => ({
          id: s.id,
          questionId: s.questionId,
          selectedOptionId: s.selectedOptionId,
          submittedAt: s.submittedAt,
        })),
      });
    }

    return NextResponse.json({
      submitted: true,
      recorded: result.recorded,
      totalRoundScore: result.totalRoundScore,
      correctCount: result.correctCount,
      leaderboard: result.leaderboard,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to submit MCQ answers" },
      { status: 500 }
    );
  }
}
