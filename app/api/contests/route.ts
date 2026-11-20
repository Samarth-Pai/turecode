import crypto from "node:crypto";
import { cookies } from "next/headers";
import { connection, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { generateJoinCode, getSessionData, mutateDb, readDb } from "@/lib/db";
import type { Contest, Round } from "@/lib/types";

export async function GET() {
  await connection();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionData(token);
  const isModerator = session.user?.role === "moderator";

  const db = await readDb();
  const sanitizedContests = db.contests.map((c) => ({
    ...c,
    joinCode: isModerator ? c.joinCode : "",
  }));

  return NextResponse.json({
    contests: sanitizedContests,
    questions: db.questions,
    stats: {
      totalContests: db.contests.length,
      totalQuestions: db.questions.length,
      totalSubmissions: db.mcqSubmissions.length + db.codingSubmissions.length,
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    const organizerId = String(body.organizerId ?? "user-mod-1");
    const organizerName = String(body.organizerName ?? "Samarth Pai");
    const customJoinCode = String(body.joinCode ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, "");

    if (!title) {
      return NextResponse.json({ error: "Contest title is required" }, { status: 400 });
    }

    const contestId = `contest-${crypto.randomUUID().slice(0, 8)}`;
    const slugBase = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const now = new Date();
    const later = new Date(now.getTime() + 24 * 3600 * 1000);

    const initialRounds: Round[] = Array.isArray(body.rounds)
      ? body.rounds.map((r: Partial<Round>, idx: number) => {
          const rType = r.type === "coding" ? "coding" : "mcq";
          const qIds = Array.isArray(r.questionIds) ? r.questionIds.map(String) : [];
          return {
            id: `round-${crypto.randomUUID().slice(0, 8)}`,
            contestId,
            title: String(r.title || `Round ${idx + 1}`),
            description: String(r.description || ""),
            type: rType,
            order: idx + 1,
            startTime: r.startTime || now.toISOString(),
            endTime: r.endTime || later.toISOString(),
            durationMinutes: Number(r.durationMinutes) || 60,
            questionIds: qIds,
            ...(rType === "mcq"
              ? {
                  sections:
                    Array.isArray(r.sections) && r.sections.length > 0
                      ? r.sections
                      : [
                          {
                            id: `sec-${crypto.randomUUID().slice(0, 8)}`,
                            title: "Section A: General",
                            questionIds: qIds,
                          },
                        ],
                }
              : {}),
          };
        })
      : [];

    const initialMcqIds: string[] = Array.isArray(body.initialMcqQuestionIds)
      ? body.initialMcqQuestionIds.map(String).filter(Boolean)
      : [];
    const initialCodingIds: string[] = Array.isArray(body.initialCodingQuestionIds)
      ? body.initialCodingQuestionIds.map(String).filter(Boolean)
      : [];

    if (initialRounds.length === 0) {
      if (initialMcqIds.length > 0) {
        initialRounds.push({
          id: `round-${crypto.randomUUID().slice(0, 8)}`,
          contestId,
          title: "Round 1: MCQ Screening",
          description: "Multiple-choice screening round.",
          type: "mcq",
          order: initialRounds.length + 1,
          startTime: now.toISOString(),
          endTime: later.toISOString(),
          durationMinutes: 30,
          questionIds: initialMcqIds,
          sections: [
            {
              id: `sec-${crypto.randomUUID().slice(0, 8)}`,
              title: "Section A: General",
              questionIds: initialMcqIds,
            },
          ],
        });
      }
      if (initialCodingIds.length > 0) {
        initialRounds.push({
          id: `round-${crypto.randomUUID().slice(0, 8)}`,
          contestId,
          title: `Round ${initialRounds.length + 1}: Coding Challenge`,
          description: "Algorithmic coding round in the Rootless Landlock Sandbox.",
          type: "coding",
          order: initialRounds.length + 1,
          startTime: now.toISOString(),
          endTime: later.toISOString(),
          durationMinutes: 90,
          questionIds: initialCodingIds,
        });
      }
    }

    const created = await mutateDb((db) => {
      let joinCode = customJoinCode || generateJoinCode();
      while (db.contests.some((c) => c.joinCode.toUpperCase() === joinCode)) {
        joinCode = generateJoinCode();
      }

      const contest: Contest = {
        id: contestId,
        title,
        slug: slugBase || contestId,
        joinCode,
        strictMode: Boolean(body.strictMode),
        description:
          description || "Multi-round competitive programming and assessment contest.",
        organizerId,
        organizerName,
        createdAt: now.toISOString(),
        rounds: initialRounds,
      };
      db.contests.unshift(contest);
      return contest;
    });

    return NextResponse.json({ contest: created }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create contest" },
      { status: 500 }
    );
  }
}
