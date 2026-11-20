import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { getSessionData, startQuestionAttempts } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = await getSessionData(token);

    const contestId = String(body.contestId ?? "");
    const roundId = String(body.roundId ?? "");
    const userId = session.user?.id || String(body.userId ?? "");
    const questionIds: string[] = Array.isArray(body.questionIds)
      ? body.questionIds.map(String)
      : body.questionId
      ? [String(body.questionId)]
      : [];

    if (!contestId || !roundId || !userId || questionIds.length === 0) {
      return NextResponse.json(
        { error: "contestId, roundId, userId, and questionId(s) are required." },
        { status: 400 }
      );
    }

    await startQuestionAttempts({ contestId, roundId, questionIds, userId });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start attempt" },
      { status: 500 }
    );
  }
}
