import { cookies } from "next/headers";
import { connection, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { getSessionData } from "@/lib/db";

export async function GET() {
  await connection();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionData(token);
  return NextResponse.json({
    user: session.user,
    enrolledContestIds: session.enrolledContestIds,
  });
}
