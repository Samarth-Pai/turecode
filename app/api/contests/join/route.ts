import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { enrollUserByJoinCode, getSessionData } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const joinCode = String(body.joinCode ?? "").trim();
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = await getSessionData(token);

    const userId = session.user?.id || String(body.userId ?? "").trim();
    if (!userId) {
      return NextResponse.json(
        { error: "Please sign in before joining a contest." },
        { status: 401 }
      );
    }

    const res = await enrollUserByJoinCode(userId, joinCode);
    if (res.error || !res.contest) {
      return NextResponse.json(
        { error: res.error || "Invalid joining code" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      contest: res.contest,
      enrolledContestIds: res.enrolledContestIds,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to join contest" },
      { status: 500 }
    );
  }
}
