import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { hashPassword, verifyPassword } from "./auth";
import { getPool } from "./postgres";
import type {
  CodingSubmission,
  Contest,
  ContestEnrollment,
  DatabaseSchema,
  LeaderboardEntry,
  MCQSubmission,
  Question,
  Round,
  User,
  UserRole,
} from "./types";

export function generateJoinCode(prefix = "TC"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return `${prefix}-${code}`;
}

async function fetchSnapshot(client: PoolClient): Promise<DatabaseSchema> {
  const [usersRes, questionsRes, contestsRes, enrollmentsRes, mcqRes, codingRes] =
    await Promise.all([
      client.query<{
        id: string;
        name: string;
        handle: string;
        email: string;
        role: UserRole;
      }>("SELECT id, name, handle, email, role FROM users ORDER BY created_at ASC"),
      client.query<{ data: Question }>(
        "SELECT data FROM questions ORDER BY created_at ASC"
      ),
      client.query<{
        id: string;
        title: string;
        slug: string;
        join_code: string;
        strict_mode: boolean;
        description: string;
        organizer_id: string;
        organizer_name: string;
        created_at: Date;
        rounds: Round[];
      }>(
        "SELECT id, title, slug, join_code, strict_mode, description, organizer_id, organizer_name, created_at, rounds FROM contests ORDER BY created_at DESC"
      ),
      client.query<{
        contest_id: string;
        user_id: string;
        joined_at: Date;
      }>("SELECT contest_id, user_id, joined_at FROM contest_enrollments"),
      client.query<{
        id: string;
        contest_id: string;
        round_id: string;
        question_id: string;
        user_id: string;
        selected_option_id: string;
        is_correct: boolean;
        score: number;
        submitted_at: Date;
      }>(
        "SELECT id, contest_id, round_id, question_id, user_id, selected_option_id, is_correct, score, submitted_at FROM mcq_submissions ORDER BY submitted_at ASC"
      ),
      client.query<{
        id: string;
        contest_id: string;
        round_id: string;
        question_id: string;
        user_id: string;
        language: CodingSubmission["language"];
        source_code: string;
        full_source_code: string;
        status: CodingSubmission["status"];
        score: number;
        max_score: number;
        passed_count: number;
        total_count: number;
        execution_time_ms: number;
        run_id: string;
        compile_error: string | null;
        test_case_results: CodingSubmission["testCaseResults"];
        submitted_at: Date;
      }>(
        "SELECT id, contest_id, round_id, question_id, user_id, language, source_code, full_source_code, status, score, max_score, passed_count, total_count, execution_time_ms, run_id, compile_error, test_case_results, submitted_at FROM coding_submissions ORDER BY submitted_at ASC"
      ),
    ]);

  const enrollments: ContestEnrollment[] = enrollmentsRes.rows.map((r) => ({
    contestId: r.contest_id,
    userId: r.user_id,
    joinedAt: new Date(r.joined_at).toISOString(),
  }));

  const enrolledByContest = new Map<string, string[]>();
  for (const e of enrollments) {
    const arr = enrolledByContest.get(e.contestId) ?? [];
    arr.push(e.userId);
    enrolledByContest.set(e.contestId, arr);
  }

  const contests: Contest[] = contestsRes.rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    joinCode: r.join_code,
    strictMode: Boolean(r.strict_mode),
    description: r.description,
    organizerId: r.organizer_id,
    organizerName: r.organizer_name,
    createdAt: new Date(r.created_at).toISOString(),
    rounds: Array.isArray(r.rounds) ? r.rounds : [],
    enrolledUserIds: enrolledByContest.get(r.id) ?? [],
  }));

  const mcqSubmissions: MCQSubmission[] = mcqRes.rows.map((r) => ({
    id: r.id,
    contestId: r.contest_id,
    roundId: r.round_id,
    questionId: r.question_id,
    userId: r.user_id,
    selectedOptionId: r.selected_option_id,
    isCorrect: r.is_correct,
    score: r.score,
    submittedAt: new Date(r.submitted_at).toISOString(),
  }));

  const codingSubmissions: CodingSubmission[] = codingRes.rows.map((r) => ({
    id: r.id,
    contestId: r.contest_id,
    roundId: r.round_id,
    questionId: r.question_id,
    userId: r.user_id,
    language: r.language,
    sourceCode: r.source_code,
    fullSourceCode: r.full_source_code,
    status: r.status,
    score: r.score,
    maxScore: r.max_score,
    passedCount: r.passed_count,
    totalCount: r.total_count,
    executionTimeMs: r.execution_time_ms,
    runId: r.run_id,
    compileError: r.compile_error ?? undefined,
    testCaseResults: Array.isArray(r.test_case_results) ? r.test_case_results : [],
    submittedAt: new Date(r.submitted_at).toISOString(),
  }));

  return {
    users: usersRes.rows,
    questions: questionsRes.rows.map((r) => r.data),
    contests,
    contestEnrollments: enrollments,
    mcqSubmissions,
    codingSubmissions,
  };
}

export async function readDb(): Promise<DatabaseSchema> {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    return await fetchSnapshot(client);
  } finally {
    client.release();
  }
}

export async function mutateDb<T>(
  mutator: (db: DatabaseSchema) => Promise<T> | T
): Promise<T> {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize read-modify-write safely across concurrent requests
    await client.query("SELECT pg_advisory_xact_lock(948271)");

    const db = await fetchSnapshot(client);
    const prevQuestionIds = new Set(db.questions.map((q) => q.id));
    const prevContestIds = new Set(db.contests.map((c) => c.id));
    const prevMcqIds = new Set(db.mcqSubmissions.map((m) => m.id));
    const prevCodingIds = new Set(db.codingSubmissions.map((c) => c.id));

    const result = await mutator(db);

    // Sync questions
    const nextQuestionIds = new Set(db.questions.map((q) => q.id));
    for (const oldId of prevQuestionIds) {
      if (!nextQuestionIds.has(oldId)) {
        await client.query("DELETE FROM questions WHERE id = $1", [oldId]);
      }
    }
    for (const q of db.questions) {
      await client.query(
        `INSERT INTO questions (id, kind, data)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, data = EXCLUDED.data`,
        [q.id, q.kind, JSON.stringify(q)]
      );
    }

    // Sync contests
    const nextContestIds = new Set(db.contests.map((c) => c.id));
    for (const oldId of prevContestIds) {
      if (!nextContestIds.has(oldId)) {
        await client.query("DELETE FROM contests WHERE id = $1", [oldId]);
      }
    }
    for (const c of db.contests) {
      await client.query(
        `INSERT INTO contests (id, title, slug, join_code, strict_mode, description, organizer_id, organizer_name, created_at, rounds)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           slug = EXCLUDED.slug,
           join_code = EXCLUDED.join_code,
           strict_mode = EXCLUDED.strict_mode,
           description = EXCLUDED.description,
           rounds = EXCLUDED.rounds`,
        [
          c.id,
          c.title,
          c.slug,
          c.joinCode || generateJoinCode(),
          Boolean(c.strictMode),
          c.description,
          c.organizerId,
          c.organizerName,
          c.createdAt,
          JSON.stringify(c.rounds),
        ]
      );
    }

    // Sync MCQ submissions
    const nextMcqIds = new Set(db.mcqSubmissions.map((m) => m.id));
    for (const oldId of prevMcqIds) {
      if (!nextMcqIds.has(oldId)) {
        await client.query("DELETE FROM mcq_submissions WHERE id = $1", [oldId]);
      }
    }
    for (const m of db.mcqSubmissions) {
      if (!prevMcqIds.has(m.id)) {
        await client.query(
          `INSERT INTO mcq_submissions (id, contest_id, round_id, question_id, user_id, selected_option_id, is_correct, score, submitted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [
            m.id,
            m.contestId,
            m.roundId,
            m.questionId,
            m.userId,
            m.selectedOptionId,
            m.isCorrect,
            m.score,
            m.submittedAt,
          ]
        );
      }
    }

    // Sync Coding submissions
    const nextCodingIds = new Set(db.codingSubmissions.map((s) => s.id));
    for (const oldId of prevCodingIds) {
      if (!nextCodingIds.has(oldId)) {
        await client.query("DELETE FROM coding_submissions WHERE id = $1", [oldId]);
      }
    }
    for (const s of db.codingSubmissions) {
      if (!prevCodingIds.has(s.id)) {
        await client.query(
          `INSERT INTO coding_submissions (id, contest_id, round_id, question_id, user_id, language, source_code, full_source_code, status, score, max_score, passed_count, total_count, execution_time_ms, run_id, compile_error, test_case_results, submitted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18)
           ON CONFLICT (id) DO NOTHING`,
          [
            s.id,
            s.contestId,
            s.roundId,
            s.questionId,
            s.userId,
            s.language,
            s.sourceCode,
            s.fullSourceCode,
            s.status,
            s.score,
            s.maxScore,
            s.passedCount,
            s.totalCount,
            s.executionTimeMs,
            s.runId,
            s.compileError ?? null,
            JSON.stringify(s.testCaseResults),
            s.submittedAt,
          ]
        );
      }
    }

    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

// ---------- Auth & Enrollment SQL Helpers ----------

export async function authenticateUser(
  email: string,
  password: string
): Promise<User | null> {
  const pool = await getPool();
  const res = await pool.query<{
    id: string;
    name: string;
    handle: string;
    email: string;
    password_hash: string;
    role: UserRole;
  }>(
    "SELECT id, name, handle, email, password_hash, role FROM users WHERE LOWER(email) = LOWER($1)",
    [email.trim()]
  );
  const row = res.rows[0];
  if (!row) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
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
  const pool = await getPool();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!name || !email || input.password.length < 4) {
    return { error: "Name, valid email, and password (4+ chars) are required." };
  }

  const existing = await pool.query("SELECT 1 FROM users WHERE LOWER(email) = $1", [
    email,
  ]);
  if ((existing.rowCount ?? 0) > 0) {
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

  await pool.query(
    `INSERT INTO users (id, name, handle, email, password_hash, role)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, name, handle, email, passwordHash, role]
  );

  return { user: { id, name, handle, email, role } };
}

export async function createSession(userId: string): Promise<string> {
  const pool = await getPool();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  await pool.query(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)",
    [token, userId, expiresAt]
  );
  return token;
}

export async function getSessionData(token: string | undefined): Promise<{
  user: User | null;
  enrolledContestIds: string[];
}> {
  if (!token) {
    return { user: null, enrolledContestIds: [] };
  }
  const pool = await getPool();
  const res = await pool.query<{
    id: string;
    name: string;
    handle: string;
    email: string;
    role: UserRole;
  }>(
    `SELECT u.id, u.name, u.handle, u.email, u.role
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );
  const user = res.rows[0] ?? null;
  if (!user) {
    return { user: null, enrolledContestIds: [] };
  }
  const enrRes = await pool.query<{ contest_id: string }>(
    "SELECT contest_id FROM contest_enrollments WHERE user_id = $1",
    [user.id]
  );
  return {
    user,
    enrolledContestIds: enrRes.rows.map((r) => r.contest_id),
  };
}

export async function deleteSession(token: string | undefined): Promise<void> {
  if (!token) return;
  const pool = await getPool();
  await pool.query("DELETE FROM sessions WHERE token = $1", [token]);
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

  const pool = await getPool();
  const contestRes = await pool.query<{
    id: string;
    title: string;
    join_code: string;
  }>(
    "SELECT id, title, join_code FROM contests WHERE UPPER(TRIM(join_code)) = $1",
    [normalized]
  );
  const contest = contestRes.rows[0];
  if (!contest) {
    return { error: `No contest found with joining code "${normalized}".` };
  }

  await pool.query(
    `INSERT INTO contest_enrollments (contest_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (contest_id, user_id) DO NOTHING`,
    [contest.id, userId]
  );

  const enrRes = await pool.query<{ contest_id: string }>(
    "SELECT contest_id FROM contest_enrollments WHERE user_id = $1",
    [userId]
  );

  return {
    contest: { id: contest.id, title: contest.title, joinCode: contest.join_code },
    enrolledContestIds: enrRes.rows.map((r) => r.contest_id),
  };
}

export async function recordProctoringViolation(
  contestId: string,
  userId: string,
  reason: string
): Promise<{ count: number; lastReason: string }> {
  const pool = await getPool();
  const res = await pool.query<{ count: number; last_reason: string }>(
    `INSERT INTO proctoring_violations (contest_id, user_id, count, last_reason, updated_at)
     VALUES ($1, $2, 1, $3, NOW())
     ON CONFLICT (contest_id, user_id)
     DO UPDATE SET
       count = proctoring_violations.count + 1,
       last_reason = EXCLUDED.last_reason,
       updated_at = NOW()
     RETURNING count, last_reason`,
    [contestId, userId, reason]
  );
  return {
    count: res.rows[0]?.count ?? 1,
    lastReason: res.rows[0]?.last_reason ?? reason,
  };
}

export async function getProctoringViolations(
  contestId: string,
  userId?: string
): Promise<{ userId: string; count: number; lastReason: string; updatedAt: string }[]> {
  const pool = await getPool();
  const res = userId
    ? await pool.query<{
        user_id: string;
        count: number;
        last_reason: string;
        updated_at: Date;
      }>(
        "SELECT user_id, count, last_reason, updated_at FROM proctoring_violations WHERE contest_id = $1 AND user_id = $2",
        [contestId, userId]
      )
    : await pool.query<{
        user_id: string;
        count: number;
        last_reason: string;
        updated_at: Date;
      }>(
        "SELECT user_id, count, last_reason, updated_at FROM proctoring_violations WHERE contest_id = $1",
        [contestId]
      );

  return res.rows.map((r) => ({
    userId: r.user_id,
    count: r.count,
    lastReason: r.last_reason,
    updatedAt: new Date(r.updated_at).toISOString(),
  }));
}

// ---------- Leaderboard Calculation ----------

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

  const userMap = new Map(db.users.map((u) => [u.id, u]));
  const entries: LeaderboardEntry[] = [];

  for (const userId of participantIds) {
    const user = userMap.get(userId);
    if (!user) continue;

    let totalScore = 0;
    let problemsAttempted = 0;
    let problemsSolved = 0;
    let totalExecutionTimeMs = 0;
    let lastSubmittedAt: string | null = null;
    const roundScores: Record<string, number> = {};

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
              if (a.executionTimeMs !== b.executionTimeMs) {
                return a.executionTimeMs - b.executionTimeMs;
              }
              return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
            })[0];

            rScore += best.score;
            totalExecutionTimeMs += best.executionTimeMs;
            if (best.status === "Accepted") problemsSolved++;
            for (const s of subs) trackTime(s.submittedAt);
          }
        }
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
      problemsAttempted,
      problemsSolved,
      totalExecutionTimeMs: Math.round(totalExecutionTimeMs * 100) / 100,
      lastSubmittedAt,
    });
  }

  entries.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.problemsSolved !== a.problemsSolved) return b.problemsSolved - a.problemsSolved;
    if (a.problemsAttempted > 0 && b.problemsAttempted > 0) {
      if (a.totalExecutionTimeMs !== b.totalExecutionTimeMs) {
        return a.totalExecutionTimeMs - b.totalExecutionTimeMs;
      }
    }
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
