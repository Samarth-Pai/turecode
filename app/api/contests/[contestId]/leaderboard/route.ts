import { cookies } from "next/headers";
import { connection, NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import {
  computeLeaderboard,
  getProctoringViolations,
  getSessionData,
  readDb,
} from "@/lib/db";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ contestId: string }> }
) {
  await connection();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionData(token);

  if (session.user?.role !== "moderator") {
    return NextResponse.json(
      { error: "Leaderboard is restricted to contest moderators." },
      { status: 403 }
    );
  }

  const { contestId } = await context.params;
  const roundId = request.nextUrl.searchParams.get("roundId") || undefined;

  const db = await readDb();
  const { contest, entries, maxPossibleScore } = computeLeaderboard(
    db,
    contestId,
    roundId
  );

  if (!contest) {
    return NextResponse.json({ error: "Contest not found" }, { status: 404 });
  }

  const violations = await getProctoringViolations(contestId);
  const violationMap = new Map(violations.map((v) => [v.userId, v]));

  const mcqSubmissions = db.mcqSubmissions
    .filter((s) => s.contestId === contestId && (!roundId || s.roundId === roundId))
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  const codingSubmissions = db.codingSubmissions
    .filter((s) => s.contestId === contestId && (!roundId || s.roundId === roundId))
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  return NextResponse.json({
    contestId: contest.id,
    contestTitle: contest.title,
    strictMode: contest.strictMode,
    roundId: roundId ?? null,
    rounds: contest.rounds,
    maxPossibleScore,
    leaderboard: entries.map((e) => ({
      ...e,
      violations: violationMap.get(e.userId)?.count ?? 0,
      lastViolationReason: violationMap.get(e.userId)?.lastReason ?? "",
    })),
    mcqSubmissions,
    codingSubmissions,
  });
}
