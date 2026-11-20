import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { clearScoreOverride, getSessionData, setScoreOverride } from "@/lib/db";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ contestId: string }> }
) {
  try {
    const { contestId } = await context.params;
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = await getSessionData(token);

    if (session.user?.role !== "moderator") {
      return NextResponse.json(
        { error: "Only contest moderators can modify participant scores." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const userId = String(body.userId ?? "");
    const roundId = String(body.roundId ?? "");
    const overrideScore = Number(body.overrideScore);
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!userId || !roundId || Number.isNaN(overrideScore)) {
      return NextResponse.json(
        { error: "userId, roundId, and numeric overrideScore are required." },
        { status: 400 }
      );
    }

    const override = await setScoreOverride({
      contestId,
      roundId,
      userId,
      overrideScore: Math.round(overrideScore),
      reason,
      updatedBy: session.user.name,
    });

    return NextResponse.json({ ok: true, override });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update score" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ contestId: string }> }
) {
  try {
    const { contestId } = await context.params;
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = await getSessionData(token);

    if (session.user?.role !== "moderator") {
      return NextResponse.json(
        { error: "Only contest moderators can revert scores." },
        { status: 403 }
      );
    }

    const userId = request.nextUrl.searchParams.get("userId") || "";
    const roundId = request.nextUrl.searchParams.get("roundId") || "";
    if (!userId || !roundId) {
      return NextResponse.json(
        { error: "userId and roundId are required." },
        { status: 400 }
      );
    }

    await clearScoreOverride({ contestId, roundId, userId });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to revert score" },
      { status: 500 }
    );
  }
}
