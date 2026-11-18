import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { createSession, registerUser } from "@/lib/db";
import type { UserRole } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");
    const role: UserRole = body.role === "moderator" ? "moderator" : "participant";

    const res = await registerUser({ name, email, password, role });
    if (res.error || !res.user) {
      return NextResponse.json(
        { error: res.error || "Registration failed" },
        { status: 400 }
      );
    }

    const token = await createSession(res.user.id);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 3600,
    });

    return NextResponse.json(
      { user: res.user, enrolledContestIds: [] },
      { status: 201 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Registration failed" },
      { status: 500 }
    );
  }
}
