import { exec as execCb } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { hashPassword } from "./auth";
import * as schema from "./schema";
import { getInitialSeedData } from "./seed";

const execAsync = promisify(execCb);

export type DrizzleDb = NodePgDatabase<typeof schema>;

const PG_PORT = Number(process.env.PG_LOCAL_PORT || 5433);
const PG_USER = process.env.PG_LOCAL_USER || os.userInfo().username || "postgres";
const PG_DB = process.env.PG_LOCAL_DB || "turecode";
const PG_DATA_DIR = path.join(process.cwd(), ".pgdata");

const globalForPg = globalThis as unknown as {
  __turecodePool?: Pool;
  __turecodeDrizzle?: DrizzleDb;
  __turecodeInitPromise?: Promise<DrizzleDb>;
};

function getConnectionString(dbName = PG_DB): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  return `postgresql://${encodeURIComponent(PG_USER)}@127.0.0.1:${PG_PORT}/${encodeURIComponent(dbName)}`;
}

async function canConnect(connStr: string): Promise<boolean> {
  const testPool = new Pool({
    connectionString: connStr,
    connectionTimeoutMillis: 1200,
    max: 1,
  });
  try {
    await testPool.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await testPool.end().catch(() => undefined);
  }
}

async function startLocalPostgresIfNeeded(): Promise<void> {
  if (process.env.DATABASE_URL && (await canConnect(process.env.DATABASE_URL))) {
    return;
  }

  const adminConn = getConnectionString("postgres");
  if (!(await canConnect(adminConn))) {
    const pgVersionFile = path.join(PG_DATA_DIR, "PG_VERSION");
    let initialized = false;
    try {
      await fs.access(pgVersionFile);
      initialized = true;
    } catch {
      initialized = false;
    }

    if (!initialized) {
      await fs.mkdir(PG_DATA_DIR, { recursive: true });
      await execAsync(
        `initdb -D "${PG_DATA_DIR}" -U "${PG_USER}" --auth=trust --encoding=UTF8 --no-instructions`,
        { timeout: 30000 }
      );
    }

    const logFile = path.join(PG_DATA_DIR, "postgres.log");
    await execAsync(
      `pg_ctl -D "${PG_DATA_DIR}" -l "${logFile}" -o "-p ${PG_PORT} -k /tmp" -w start`,
      { timeout: 30000 }
    );
  }

  const adminPool = new Pool({ connectionString: adminConn, max: 1 });
  try {
    const res = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [PG_DB]
    );
    if (res.rowCount === 0) {
      const safeName = PG_DB.replace(/[^a-zA-Z0-9_]/g, "");
      await adminPool.query(`CREATE DATABASE "${safeName}"`);
    }
  } finally {
    await adminPool.end().catch(() => undefined);
  }
}

async function runMigrationsAndSeed(pool: Pool, db: DrizzleDb): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      handle TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS contests (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      join_code TEXT UNIQUE NOT NULL,
      strict_mode BOOLEAN NOT NULL DEFAULT FALSE,
      description TEXT NOT NULL,
      organizer_id TEXT NOT NULL,
      organizer_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      rounds JSONB NOT NULL
    );

    ALTER TABLE contests ADD COLUMN IF NOT EXISTS strict_mode BOOLEAN NOT NULL DEFAULT FALSE;

    CREATE TABLE IF NOT EXISTS proctoring_violations (
      contest_id TEXT NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      count INTEGER NOT NULL DEFAULT 0,
      last_reason TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (contest_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS question_attempts (
      contest_id TEXT NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
      round_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (contest_id, round_id, question_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS score_overrides (
      contest_id TEXT NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
      round_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      override_score INTEGER NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      updated_by TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (contest_id, round_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS contest_enrollments (
      contest_id TEXT NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (contest_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS mcq_submissions (
      id TEXT PRIMARY KEY,
      contest_id TEXT NOT NULL,
      round_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      selected_option_id TEXT NOT NULL,
      is_correct BOOLEAN NOT NULL,
      score INTEGER NOT NULL,
      time_taken_seconds INTEGER NOT NULL DEFAULT 0,
      submitted_at TIMESTAMPTZ NOT NULL
    );

    ALTER TABLE mcq_submissions ADD COLUMN IF NOT EXISTS time_taken_seconds INTEGER NOT NULL DEFAULT 0;

    CREATE TABLE IF NOT EXISTS coding_submissions (
      id TEXT PRIMARY KEY,
      contest_id TEXT NOT NULL,
      round_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      language TEXT NOT NULL,
      source_code TEXT NOT NULL,
      full_source_code TEXT NOT NULL,
      status TEXT NOT NULL,
      score INTEGER NOT NULL,
      max_score INTEGER NOT NULL,
      passed_count INTEGER NOT NULL,
      total_count INTEGER NOT NULL,
      execution_time_ms DOUBLE PRECISION NOT NULL,
      time_taken_seconds INTEGER NOT NULL DEFAULT 0,
      run_id TEXT NOT NULL,
      compile_error TEXT,
      test_case_results JSONB NOT NULL,
      submitted_at TIMESTAMPTZ NOT NULL
    );

    ALTER TABLE coding_submissions ADD COLUMN IF NOT EXISTS time_taken_seconds INTEGER NOT NULL DEFAULT 0;
  `);

  const countRows = await db
    .select({ cnt: sql<number>`COUNT(*)::int` })
    .from(schema.users);

  if ((countRows[0]?.cnt ?? 0) > 0) {
    const seed = getInitialSeedData();
    for (const q of seed.questions) {
      if (q.kind === "coding") {
        await db
          .execute(
            sql`UPDATE questions
                SET data = ${JSON.stringify(q)}::jsonb
                WHERE id = ${q.id}
                  AND NOT EXISTS (
                    SELECT 1 FROM jsonb_array_elements(data->'testCases') tc
                    WHERE tc->>'explanation' IS NOT NULL
                  )`
          )
          .catch(() => undefined);
      } else {
        await db
          .execute(
            sql`UPDATE questions
                SET data = ${JSON.stringify(q)}::jsonb
                WHERE id = ${q.id}
                  AND data ? 'title'`
          )
          .catch(() => undefined);
      }
    }

    for (const c of seed.contests) {
      await db
        .execute(
          sql`UPDATE contests
              SET rounds = ${JSON.stringify(c.rounds)}::jsonb
              WHERE id = ${c.id}
                AND NOT EXISTS (
                  SELECT 1 FROM jsonb_array_elements(rounds) r
                  WHERE r->>'type' = 'mcq' AND r ? 'sections'
                )`
        )
        .catch(() => undefined);
    }

    for (const m of seed.mcqSubmissions) {
      if (m.timeTakenSeconds) {
        await db
          .execute(
            sql`UPDATE mcq_submissions SET time_taken_seconds = ${m.timeTakenSeconds}
                WHERE id = ${m.id} AND time_taken_seconds = 0`
          )
          .catch(() => undefined);
      }
    }
    for (const s of seed.codingSubmissions) {
      if (s.timeTakenSeconds) {
        await db
          .execute(
            sql`UPDATE coding_submissions SET time_taken_seconds = ${s.timeTakenSeconds}
                WHERE id = ${s.id} AND time_taken_seconds = 0`
          )
          .catch(() => undefined);
      }
    }
    return;
  }

  const seed = getInitialSeedData();
  const defaultPasswordHash = hashPassword("password123");

  await db.transaction(async (tx) => {
    if (seed.users.length > 0) {
      await tx
        .insert(schema.users)
        .values(
          seed.users.map((u) => ({
            id: u.id,
            name: u.name,
            handle: u.handle,
            email: u.email.toLowerCase(),
            passwordHash: defaultPasswordHash,
            role: u.role,
          }))
        )
        .onConflictDoNothing();
    }

    if (seed.questions.length > 0) {
      await tx
        .insert(schema.questions)
        .values(
          seed.questions.map((q) => ({
            id: q.id,
            kind: q.kind,
            data: q,
          }))
        )
        .onConflictDoNothing();
    }

    if (seed.contests.length > 0) {
      await tx
        .insert(schema.contests)
        .values(
          seed.contests.map((c) => ({
            id: c.id,
            title: c.title,
            slug: c.slug,
            joinCode: c.joinCode,
            strictMode: c.strictMode,
            description: c.description,
            organizerId: c.organizerId,
            organizerName: c.organizerName,
            createdAt: new Date(c.createdAt),
            rounds: c.rounds,
          }))
        )
        .onConflictDoNothing();
    }

    if (seed.contestEnrollments.length > 0) {
      await tx
        .insert(schema.contestEnrollments)
        .values(
          seed.contestEnrollments.map((enr) => ({
            contestId: enr.contestId,
            userId: enr.userId,
            joinedAt: new Date(enr.joinedAt),
          }))
        )
        .onConflictDoNothing();
    }

    if (seed.mcqSubmissions.length > 0) {
      await tx
        .insert(schema.mcqSubmissions)
        .values(
          seed.mcqSubmissions.map((m) => ({
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

    if (seed.codingSubmissions.length > 0) {
      await tx
        .insert(schema.codingSubmissions)
        .values(
          seed.codingSubmissions.map((s) => ({
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
  });
}

/** Returns the singleton Drizzle ORM database adapter backed by PostgreSQL. */
export async function getDb(): Promise<DrizzleDb> {
  if (globalForPg.__turecodeDrizzle) {
    return globalForPg.__turecodeDrizzle;
  }
  if (!globalForPg.__turecodeInitPromise) {
    globalForPg.__turecodeInitPromise = (async () => {
      await startLocalPostgresIfNeeded();
      const pool = new Pool({
        connectionString: getConnectionString(),
        max: 15,
      });
      const db = drizzle(pool, { schema });
      await runMigrationsAndSeed(pool, db);
      globalForPg.__turecodePool = pool;
      globalForPg.__turecodeDrizzle = db;
      return db;
    })().catch((err) => {
      globalForPg.__turecodeInitPromise = undefined;
      throw err;
    });
  }
  return globalForPg.__turecodeInitPromise;
}

/** Returns the underlying pg Pool after ensuring initialization completes. */
export async function getPool(): Promise<Pool> {
  await getDb();
  return globalForPg.__turecodePool!;
}

/** Closes the singleton PostgreSQL pool (used by CLI maintenance scripts). */
export async function closeDb(): Promise<void> {
  const pool = globalForPg.__turecodePool;
  globalForPg.__turecodePool = undefined;
  globalForPg.__turecodeDrizzle = undefined;
  globalForPg.__turecodeInitPromise = undefined;
  if (pool) {
    await pool.end();
  }
}
