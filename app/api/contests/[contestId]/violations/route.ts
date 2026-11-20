import { cookies } from "next/headers";
import { connection, NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import {
  getProctoringViolations,
  getSessionData,
  recordProctoringViolation,
  resetProctoringViolation,
} from "@/lib/db";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ contestId: string }> }
) {
  await connection();
  const { contestId } = await context.params;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionData(token);

  const userIdParam = request.nextUrl.searchParams.get("userId");
  const targetUserId =
    session.user?.role === "moderator"
      ? userIdParam || undefined
      : session.user?.id || userIdParam || undefined;

  if (!targetUserId && session.user?.role !== "moderator") {
    return NextResponse.json({ violations: [] });
  }

  const violations = await getProctoringViolations(contestId, targetUserId);
  return NextResponse.json({ violations });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ contestId: string }> }
) {
  try {
    const { contestId } = await context.params;
    const body = await request.json();
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = await getSessionData(token);

    const userId = session.user?.id || String(body.userId ?? "");
    const reason = String(body.reason ?? "Exited fullscreen or switched tab");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = await recordProctoringViolation(contestId, userId, reason);
    return NextResponse.json(res);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to record violation" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ contestId: string }> }
) {
  try {
    const { contestId } = await context.params;
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = await getSessionData(token);

    if (session.user?.role !== "moderator") {
      return NextResponse.json(
        { error: "Only moderators can reset proctoring penalty limits." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const userId = String(body.userId ?? "");
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const res = await resetProctoringViolation(contestId, userId);
    return NextResponse.json({ ok: true, ...res });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reset penalty limit" },
      { status: 500 }
    );
  }
}
