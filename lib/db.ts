import crypto from "node:crypto";
import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { hashPassword, verifyPassword } from "./auth";
import { type DrizzleDb, getDb } from "./postgres";
import * as schema from "./schema";
import type {
  CodingSubmission,
  Contest,
  ContestEnrollment,
  DatabaseSchema,
  LeaderboardEntry,
  MCQSubmission,
  Question,
  QuestionAttempt,
  ScoreOverride,
  User,
  UserRole,
} from "./types";

type DbOrTx = DrizzleDb | Parameters<Parameters<DrizzleDb["transaction"]>[0]>[0];

export function generateJoinCode(prefix = "TC"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return `${prefix}-${code}`;
}

async function fetchSnapshot(db: DbOrTx): Promise<DatabaseSchema> {
  const [
    usersRows,
    questionsRows,
    contestsRows,
    enrollmentsRows,
    mcqRows,
    codingRows,
    attemptsRows,
    overridesRows,
  ] = await Promise.all([
    db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        handle: schema.users.handle,
        email: schema.users.email,
        role: schema.users.role,
      })
      .from(schema.users)
      .orderBy(asc(schema.users.createdAt)),
    db
      .select({ data: schema.questions.data })
      .from(schema.questions)
      .orderBy(asc(schema.questions.createdAt)),
    db
      .select()
      .from(schema.contests)
      .orderBy(desc(schema.contests.createdAt)),
    db.select().from(schema.contestEnrollments),
    db
      .select()
      .from(schema.mcqSubmissions)
      .orderBy(asc(schema.mcqSubmissions.submittedAt)),
    db
      .select()
      .from(schema.codingSubmissions)
      .orderBy(asc(schema.codingSubmissions.submittedAt)),
    db.select().from(schema.questionAttempts),
    db.select().from(schema.scoreOverrides),
  ]);

  const enrollments: ContestEnrollment[] = enrollmentsRows.map((r) => ({
    contestId: r.contestId,
    userId: r.userId,
    joinedAt: r.joinedAt.toISOString(),
  }));

  const enrolledByContest = new Map<string, string[]>();
  for (const e of enrollments) {
    const arr = enrolledByContest.get(e.contestId) ?? [];
    arr.push(e.userId);
    enrolledByContest.set(e.contestId, arr);
  }

  const contests: Contest[] = contestsRows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    joinCode: r.joinCode,
    strictMode: Boolean(r.strictMode),
    description: r.description,
    organizerId: r.organizerId,
    organizerName: r.organizerName,
    createdAt: r.createdAt.toISOString(),
    rounds: Array.isArray(r.rounds) ? r.rounds : [],
    enrolledUserIds: enrolledByContest.get(r.id) ?? [],
  }));

  const mcqSubmissions: MCQSubmission[] = mcqRows.map((r) => ({
    id: r.id,
    contestId: r.contestId,
    roundId: r.roundId,
    questionId: r.questionId,
    userId: r.userId,
    selectedOptionId: r.selectedOptionId,
    isCorrect: r.isCorrect,
    score: r.score,
    timeTakenSeconds: r.timeTakenSeconds ?? 0,
    submittedAt: r.submittedAt.toISOString(),
  }));

  const codingSubmissions: CodingSubmission[] = codingRows.map((r) => ({
    id: r.id,
    contestId: r.contestId,
    roundId: r.roundId,
    questionId: r.questionId,
    userId: r.userId,
    language: r.language,
    sourceCode: r.sourceCode,
    fullSourceCode: r.fullSourceCode,
    status: r.status,
    score: r.score,
    maxScore: r.maxScore,
    passedCount: r.passedCount,
    totalCount: r.totalCount,
    executionTimeMs: r.executionTimeMs,
    timeTakenSeconds: r.timeTakenSeconds ?? 0,
    runId: r.runId,
    compileError: r.compileError ?? undefined,
    testCaseResults: Array.isArray(r.testCaseResults) ? r.testCaseResults : [],
    submittedAt: r.submittedAt.toISOString(),
  }));

  const questionAttempts: QuestionAttempt[] = attemptsRows.map((r) => ({
    contestId: r.contestId,
    roundId: r.roundId,
    questionId: r.questionId,
    userId: r.userId,
    startedAt: r.startedAt.toISOString(),
  }));

  const scoreOverrides: ScoreOverride[] = overridesRows.map((r) => ({
    contestId: r.contestId,
    roundId: r.roundId,
    userId: r.userId,
    overrideScore: r.overrideScore,
    reason: r.reason,
    updatedBy: r.updatedBy,
    updatedAt: r.updatedAt.toISOString(),
  }));

  return {
    users: usersRows,
    questions: questionsRows.map((r) => r.data),
    contests,
    contestEnrollments: enrollments,
    mcqSubmissions,
    codingSubmissions,
    questionAttempts,
    scoreOverrides,
  };
}

export async function readDb(): Promise<DatabaseSchema> {
  const db = await getDb();
  return fetchSnapshot(db);
}

export async function mutateDb<T>(
  mutator: (db: DatabaseSchema) => Promise<T> | T
): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(948271)`);

    const snapshot = await fetchSnapshot(tx);
    const prevQuestionIds = new Set(snapshot.questions.map((q) => q.id));
    const prevContestIds = new Set(snapshot.contests.map((c) => c.id));
    const prevMcqIds = new Set(snapshot.mcqSubmissions.map((m) => m.id));
    const prevCodingIds = new Set(snapshot.codingSubmissions.map((c) => c.id));

    const result = await mutator(snapshot);

    // Sync questions
    const nextQuestionIds = new Set(snapshot.questions.map((q) => q.id));
    const deletedQIds = [...prevQuestionIds].filter((id) => !nextQuestionIds.has(id));
    if (deletedQIds.length > 0) {
      await tx.delete(schema.questions).where(inArray(schema.questions.id, deletedQIds));
    }
    for (const q of snapshot.questions) {
      await tx
        .insert(schema.questions)
        .values({ id: q.id, kind: q.kind, data: q })
        .onConflictDoUpdate({
          target: schema.questions.id,
          set: { kind: q.kind, data: q },
        });
    }

    // Sync contests
    const nextContestIds = new Set(snapshot.contests.map((c) => c.id));
    const deletedCIds = [...prevContestIds].filter((id) => !nextContestIds.has(id));
    if (deletedCIds.length > 0) {
      await tx.delete(schema.contests).where(inArray(schema.contests.id, deletedCIds));
    }
    for (const c of snapshot.contests) {
      const joinCode = c.joinCode || generateJoinCode();
      await tx
        .insert(schema.contests)
        .values({
          id: c.id,
          title: c.title,
          slug: c.slug,
          joinCode,
          strictMode: Boolean(c.strictMode),
          description: c.description,
          organizerId: c.organizerId,
          organizerName: c.organizerName,
          createdAt: new Date(c.createdAt),
          rounds: c.rounds,
        })
        .onConflictDoUpdate({
          target: schema.contests.id,
          set: {
            title: c.title,
            slug: c.slug,
            joinCode,
            strictMode: Boolean(c.strictMode),
            description: c.description,
            rounds: c.rounds,
          },
        });
    }

    // Sync MCQ submissions
    const nextMcqIds = new Set(snapshot.mcqSubmissions.map((m) => m.id));
    const deletedMcqIds = [...prevMcqIds].filter((id) => !nextMcqIds.has(id));
    if (deletedMcqIds.length > 0) {
      await tx
        .delete(schema.mcqSubmissions)
        .where(inArray(schema.mcqSubmissions.id, deletedMcqIds));
    }
    const newMcqs = snapshot.mcqSubmissions.filter((m) => !prevMcqIds.has(m.id));
    if (newMcqs.length > 0) {
      await tx
        .insert(schema.mcqSubmissions)
        .values(
          newMcqs.map((m) => ({
            id: m.id,
            contestId: m.contestId,
            roundId: m.roundId,
            questionId: m.questionId,
            userId: m.userId,
            selectedOptionId: m.selectedOptionId,
            isCorrect: m.isCorrect,
            score: m.score,
            timeTakenSeconds: m.timeTakenSeconds ?? 0,
            submittedAt: new Date(m.submittedAt),
          }))
        )
        .onConflictDoNothing();
    }

    // Sync Coding submissions
    const nextCodingIds = new Set(snapshot.codingSubmissions.map((s) => s.id));
    const deletedCodingIds = [...prevCodingIds].filter(
      (id) => !nextCodingIds.has(id)
    );
    if (deletedCodingIds.length > 0) {
      await tx
        .delete(schema.codingSubmissions)
        .where(inArray(schema.codingSubmissions.id, deletedCodingIds));
    }
    const newCodings = snapshot.codingSubmissions.filter(
      (s) => !prevCodingIds.has(s.id)
    );
    if (newCodings.length > 0) {
      await tx
        .insert(schema.codingSubmissions)
        .values(
          newCodings.map((s) => ({
            id: s.id,
            contestId: s.contestId,
            roundId: s.roundId,
            questionId: s.questionId,
            userId: s.userId,
            language: s.language,
            sourceCode: s.sourceCode,
            fullSourceCode: s.fullSourceCode,
            status: s.status,
            score: s.score,
            maxScore: s.maxScore,
            passedCount: s.passedCount,
            totalCount: s.totalCount,
            executionTimeMs: s.executionTimeMs,
            timeTakenSeconds: s.timeTakenSeconds ?? 0,
            runId: s.runId,
            compileError: s.compileError ?? null,
            testCaseResults: s.testCaseResults,
            submittedAt: new Date(s.submittedAt),
          }))
        )
        .onConflictDoNothing();
    }

    return result;
  });
}

// ---------- Auth, Enrollment, Attempts, Overrides & Proctoring Helpers ----------

export async function authenticateUser(
  email: string,
  password: string
): Promise<User | null> {
  const db = await getDb();
  const normalized = email.trim().toLowerCase();
  const rows = await db
    .select()
    .from(schema.users)
    .where(sql`LOWER(${schema.users.email}) = ${normalized}`)
    .limit(1);

  const row = rows[0];
  if (!row || !verifyPassword(password, row.passwordHash)) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    email: row.email,
    role: row.role,
  };
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<{ user?: User; error?: string }> {
  const db = await getDb();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!name || !email || input.password.length < 4) {
    return { error: "Name, valid email, and password (4+ chars) are required." };
  }

  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(sql`LOWER(${schema.users.email}) = ${email}`)
    .limit(1);

  if (existing.length > 0) {
    return { error: "An account with this email already exists." };
  }

  const baseHandle =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "coder";
  const handle = `${baseHandle}_${crypto.randomInt(100, 999)}`;
  const id = `user-${crypto.randomUUID().slice(0, 8)}`;
  const passwordHash = hashPassword(input.password);
  const role: UserRole = input.role === "moderator" ? "moderator" : "participant";

  await db.insert(schema.users).values({
    id,
    name,
    handle,
    email,
    passwordHash,
    role,
  });

  return { user: { id, name, handle, email, role } };
}

export async function createSession(userId: string): Promise<string> {
  const db = await getDb();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await db.insert(schema.sessions).values({
    token,
    userId,
    expiresAt,
  });
  return token;
}

export async function getSessionData(token: string | undefined): Promise<{
  user: User | null;
  enrolledContestIds: string[];
}> {
  if (!token) {
    return { user: null, enrolledContestIds: [] };
  }
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      handle: schema.users.handle,
      email: schema.users.email,
      role: schema.users.role,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(
      and(
        eq(schema.sessions.token, token),
        gt(schema.sessions.expiresAt, new Date())
      )
    )
    .limit(1);

  const user = rows[0] ?? null;
  if (!user) {
    return { user: null, enrolledContestIds: [] };
  }

  const enrRows = await db
    .select({ contestId: schema.contestEnrollments.contestId })
    .from(schema.contestEnrollments)
    .where(eq(schema.contestEnrollments.userId, user.id));

  return {
    user,
    enrolledContestIds: enrRows.map((r) => r.contestId),
  };
}

export async function deleteSession(token: string | undefined): Promise<void> {
  if (!token) return;
  const db = await getDb();
  await db.delete(schema.sessions).where(eq(schema.sessions.token, token));
}

export async function enrollUserByJoinCode(
  userId: string,
  joinCode: string
): Promise<{
  contest?: { id: string; title: string; joinCode: string };
  enrolledContestIds?: string[];
  error?: string;
}> {
  const normalized = joinCode.trim().toUpperCase();
  if (!normalized) {
    return { error: "Please enter a valid joining code." };
  }

  const db = await getDb();
  const contestRows = await db
    .select({
      id: schema.contests.id,
      title: schema.contests.title,
      joinCode: schema.contests.joinCode,
    })
    .from(schema.contests)
    .where(sql`UPPER(TRIM(${schema.contests.joinCode})) = ${normalized}`)
    .limit(1);

  const contest = contestRows[0];
  if (!contest) {
    return { error: `No contest found with joining code "${normalized}".` };
  }

  await db
    .insert(schema.contestEnrollments)
    .values({ contestId: contest.id, userId })
    .onConflictDoNothing();

  const enrRows = await db
    .select({ contestId: schema.contestEnrollments.contestId })
    .from(schema.contestEnrollments)
    .where(eq(schema.contestEnrollments.userId, userId));

  return {
    contest,
    enrolledContestIds: enrRows.map((r) => r.contestId),
  };
}

export async function startQuestionAttempts(input: {
  contestId: string;
  roundId: string;
  questionIds: string[];
  userId: string;
}): Promise<void> {
  const { contestId, roundId, questionIds, userId } = input;
  const uniqueIds = [...new Set(questionIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;

  const db = await getDb();
  await db
    .insert(schema.questionAttempts)
    .values(
      uniqueIds.map((qId) => ({
        contestId,
        roundId,
        questionId: qId,
        userId,
      }))
    )
    .onConflictDoNothing();
}

export async function computeSolveTimeSeconds(input: {
  contestId: string;
  roundId: string;
  questionId: string;
  userId: string;
  roundStartTimeIso?: string;
}): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ startedAt: schema.questionAttempts.startedAt })
    .from(schema.questionAttempts)
    .where(
      and(
        eq(schema.questionAttempts.contestId, input.contestId),
        eq(schema.questionAttempts.roundId, input.roundId),
        eq(schema.questionAttempts.questionId, input.questionId),
        eq(schema.questionAttempts.userId, input.userId)
      )
    )
    .limit(1);

  const startMs = rows[0]?.startedAt
    ? rows[0].startedAt.getTime()
    : input.roundStartTimeIso
    ? new Date(input.roundStartTimeIso).getTime()
    : Date.now();

  if (Number.isNaN(startMs)) return 1;
  return Math.max(1, Math.round((Date.now() - startMs) / 1000));
}

export async function recordProctoringViolation(
  contestId: string,
  userId: string,
  reason: string
): Promise<{ count: number; lastReason: string }> {
  const db = await getDb();
  const rows = await db
    .insert(schema.proctoringViolations)
    .values({
      contestId,
      userId,
      count: 1,
      lastReason: reason,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        schema.proctoringViolations.contestId,
        schema.proctoringViolations.userId,
      ],
      set: {
        count: sql`${schema.proctoringViolations.count} + 1`,
        lastReason: reason,
        updatedAt: new Date(),
      },
    })
    .returning({
      count: schema.proctoringViolations.count,
      lastReason: schema.proctoringViolations.lastReason,
    });

  return {
    count: rows[0]?.count ?? 1,
    lastReason: rows[0]?.lastReason ?? reason,
  };
}

export async function resetProctoringViolation(
  contestId: string,
  userId: string
): Promise<{ count: number; lastReason: string }> {
  const db = await getDb();
  await db
    .insert(schema.proctoringViolations)
    .values({
      contestId,
      userId,
      count: 0,
      lastReason: "Reset by moderator",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        schema.proctoringViolations.contestId,
        schema.proctoringViolations.userId,
      ],
      set: {
        count: 0,
        lastReason: "Reset by moderator",
        updatedAt: new Date(),
      },
    });

  return { count: 0, lastReason: "Reset by moderator" };
}

export async function getProctoringViolations(
  contestId: string,
  userId?: string
): Promise<{ userId: string; count: number; lastReason: string; updatedAt: string }[]> {
  const db = await getDb();
  const whereClause = userId
    ? and(
        eq(schema.proctoringViolations.contestId, contestId),
        eq(schema.proctoringViolations.userId, userId)
      )
    : eq(schema.proctoringViolations.contestId, contestId);

  const rows = await db
    .select()
    .from(schema.proctoringViolations)
    .where(whereClause);

  return rows.map((r) => ({
    userId: r.userId,
    count: r.count,
    lastReason: r.lastReason,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function setScoreOverride(input: {
  contestId: string;
  roundId: string;
  userId: string;
  overrideScore: number;
  reason?: string;
  updatedBy?: string;
}): Promise<ScoreOverride> {
  const db = await getDb();
  const now = new Date();
  const rows = await db
    .insert(schema.scoreOverrides)
    .values({
      contestId: input.contestId,
      roundId: input.roundId,
      userId: input.userId,
      overrideScore: input.overrideScore,
      reason: input.reason ?? "",
      updatedBy: input.updatedBy ?? "",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        schema.scoreOverrides.contestId,
        schema.scoreOverrides.roundId,
        schema.scoreOverrides.userId,
      ],
      set: {
        overrideScore: input.overrideScore,
        reason: input.reason ?? "",
        updatedBy: input.updatedBy ?? "",
        updatedAt: now,
      },
    })
    .returning();

  const row = rows[0];
  return {
    contestId: row.contestId,
    roundId: row.roundId,
    userId: row.userId,
    overrideScore: row.overrideScore,
    reason: row.reason,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function clearScoreOverride(input: {
  contestId: string;
  roundId: string;
  userId: string;
}): Promise<void> {
  const db = await getDb();
  await db
    .delete(schema.scoreOverrides)
    .where(
      and(
        eq(schema.scoreOverrides.contestId, input.contestId),
        eq(schema.scoreOverrides.roundId, input.roundId),
        eq(schema.scoreOverrides.userId, input.userId)
      )
    );
}

// ---------- Leaderboard Calculation & Solve-Time Tiebreaker ----------

export function getQuestionPoints(q: Question): number {
  if (q.kind === "mcq") return q.points;
  const tcSum = q.testCases.reduce((acc, tc) => acc + tc.points, 0);
  return tcSum > 0 ? tcSum : q.points;
}

export function computeLeaderboard(
  db: DatabaseSchema,
  contestId: string,
  roundId?: string
): {
  contest: Contest | null;
  entries: LeaderboardEntry[];
  maxPossibleScore: number;
} {
  const contest = db.contests.find((c) => c.id === contestId) ?? null;
  if (!contest) {
    return { contest: null, entries: [], maxPossibleScore: 0 };
  }

  const targetRounds = roundId
    ? contest.rounds.filter((r) => r.id === roundId)
    : contest.rounds;

  const questionMap = new Map<string, Question>(
    db.questions.map((q) => [q.id, q])
  );

  let maxPossibleScore = 0;
  for (const r of targetRounds) {
    for (const qId of r.questionIds) {
      const q = questionMap.get(qId);
      if (q) maxPossibleScore += getQuestionPoints(q);
    }
  }

  const participantIds = new Set<string>(
    db.contestEnrollments
      .filter((e) => e.contestId === contestId)
      .map((e) => e.userId)
  );
  for (const sub of db.mcqSubmissions) {
    if (sub.contestId === contestId) participantIds.add(sub.userId);
  }
  for (const sub of db.codingSubmissions) {
    if (sub.contestId === contestId) participantIds.add(sub.userId);
  }

  const overrides = (db.scoreOverrides ?? []).filter(
    (o) => o.contestId === contestId
  );
  const overrideMap = new Map<string, ScoreOverride>(
    overrides.map((o) => [`${o.roundId}:${o.userId}`, o])
  );

  const userMap = new Map(db.users.map((u) => [u.id, u]));
  const entries: LeaderboardEntry[] = [];

  for (const userId of participantIds) {
    const user = userMap.get(userId);
    if (!user) continue;

    let totalScore = 0;
    let problemsAttempted = 0;
    let problemsSolved = 0;
    let totalSolveTimeSeconds = 0;
    let totalExecutionTimeMs = 0;
    let lastSubmittedAt: string | null = null;
    const roundScores: Record<string, number> = {};
    const originalRoundScores: Record<string, number> = {};
    const overriddenRoundIds: string[] = [];
    const questionSolveTimes: Record<string, number> = {};

    const trackTime = (iso: string) => {
      if (!lastSubmittedAt || new Date(iso).getTime() > new Date(lastSubmittedAt).getTime()) {
        lastSubmittedAt = iso;
      }
    };

    for (const round of targetRounds) {
      let rScore = 0;

      if (round.type === "mcq") {
        for (const qId of round.questionIds) {
          const subs = db.mcqSubmissions
            .filter(
              (s) =>
                s.contestId === contestId &&
                s.roundId === round.id &&
                s.questionId === qId &&
                s.userId === userId
            )
            .sort(
              (a, b) =>
                new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
            );

          if (subs.length > 0) {
            const latest = subs[0];
            rScore += latest.score;
            problemsAttempted++;
            if (latest.isCorrect) problemsSolved++;
            const qSec = latest.timeTakenSeconds ?? 0;
            if (qSec > 0) {
              questionSolveTimes[qId] = qSec;
              totalSolveTimeSeconds += qSec;
            }
            trackTime(latest.submittedAt);
          }
        }
      } else {
        for (const qId of round.questionIds) {
          const subs = db.codingSubmissions.filter(
            (s) =>
              s.contestId === contestId &&
              s.roundId === round.id &&
              s.questionId === qId &&
              s.userId === userId
          );

          if (subs.length > 0) {
            problemsAttempted++;
            const best = [...subs].sort((a, b) => {
              if (b.score !== a.score) return b.score - a.score;
              const aSec = a.timeTakenSeconds ?? 0;
              const bSec = b.timeTakenSeconds ?? 0;
              if (aSec > 0 && bSec > 0 && aSec !== bSec) return aSec - bSec;
              if (a.executionTimeMs !== b.executionTimeMs) {
                return a.executionTimeMs - b.executionTimeMs;
              }
              return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
            })[0];

            rScore += best.score;
            totalExecutionTimeMs += best.executionTimeMs;
            if (best.status === "Accepted") problemsSolved++;
            const qSec = best.timeTakenSeconds ?? 0;
            if (qSec > 0) {
              questionSolveTimes[qId] = qSec;
              totalSolveTimeSeconds += qSec;
            }
            for (const s of subs) trackTime(s.submittedAt);
          }
        }
      }

      originalRoundScores[round.id] = rScore;
      const override = overrideMap.get(`${round.id}:${userId}`);
      if (override) {
        rScore = override.overrideScore;
        overriddenRoundIds.push(round.id);
      }

      roundScores[round.id] = rScore;
      totalScore += rScore;
    }

    entries.push({
      rank: 0,
      userId: user.id,
      userName: user.name,
      userHandle: user.handle,
      totalScore,
      maxPossibleScore,
      roundScores,
      originalRoundScores,
      overriddenRoundIds,
      problemsAttempted,
      problemsSolved,
      totalSolveTimeSeconds,
      questionSolveTimes,
      totalExecutionTimeMs: Math.round(totalExecutionTimeMs * 100) / 100,
      lastSubmittedAt,
    });
  }

  entries.sort((a, b) => {
    // 1. Highest total score
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    // 2. Most solved problems
    if (b.problemsSolved !== a.problemsSolved) return b.problemsSolved - a.problemsSolved;
    // 3. Lowest cumulative solve time across questions (primary time tiebreaker)
    if (a.problemsAttempted > 0 && b.problemsAttempted > 0) {
      if (a.totalSolveTimeSeconds !== b.totalSolveTimeSeconds) {
        if (a.totalSolveTimeSeconds === 0) return 1;
        if (b.totalSolveTimeSeconds === 0) return -1;
        return a.totalSolveTimeSeconds - b.totalSolveTimeSeconds;
      }
      // 4. Fastest sandbox execution runtime
      if (a.totalExecutionTimeMs !== b.totalExecutionTimeMs) {
        return a.totalExecutionTimeMs - b.totalExecutionTimeMs;
      }
    }
    // 5. Earliest final submission
    if (a.lastSubmittedAt && b.lastSubmittedAt) {
      return new Date(a.lastSubmittedAt).getTime() - new Date(b.lastSubmittedAt).getTime();
    }
    if (a.lastSubmittedAt) return -1;
    if (b.lastSubmittedAt) return 1;
    return a.userName.localeCompare(b.userName);
  });

  entries.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  return { contest, entries, maxPossibleScore };
}
