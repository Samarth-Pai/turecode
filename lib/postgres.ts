import { exec as execCb } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Pool } from "pg";
import { hashPassword } from "./auth";
import { getInitialSeedData } from "./seed";

const execAsync = promisify(execCb);

const PG_PORT = Number(process.env.PG_LOCAL_PORT || 5433);
const PG_USER = process.env.PG_LOCAL_USER || os.userInfo().username || "postgres";
const PG_DB = process.env.PG_LOCAL_DB || "turecode";
const PG_DATA_DIR = path.join(process.cwd(), ".pgdata");

const globalForPg = globalThis as unknown as {
  __turecodePool?: Pool;
  __turecodeInitPromise?: Promise<Pool>;
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

  // Ensure target database exists
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

async function runMigrationsAndSeed(pool: Pool): Promise<void> {
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
      submitted_at TIMESTAMPTZ NOT NULL
    );

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
      run_id TEXT NOT NULL,
      compile_error TEXT,
      test_case_results JSONB NOT NULL,
      submitted_at TIMESTAMPTZ NOT NULL
    );
  `);

  const countRes = await pool.query<{ cnt: number }>(
    "SELECT COUNT(*)::int AS cnt FROM users"
  );
  if ((countRes.rows[0]?.cnt ?? 0) > 0) {
    // Ensure seeded sample explanations exist on existing DBs
    const seed = getInitialSeedData();
    for (const q of seed.questions) {
      if (q.kind === "coding") {
        await pool.query(
          `UPDATE questions
           SET data = $2::jsonb
           WHERE id = $1
             AND NOT EXISTS (
               SELECT 1 FROM jsonb_array_elements(data->'testCases') tc
               WHERE tc->>'explanation' IS NOT NULL
             )`,
          [q.id, JSON.stringify(q)]
        ).catch(() => undefined);
      }
    }
    return;
  }

  const seed = getInitialSeedData();
  const defaultPasswordHash = hashPassword("password123");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const u of seed.users) {
      await client.query(
        `INSERT INTO users (id, name, handle, email, password_hash, role)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [u.id, u.name, u.handle, u.email.toLowerCase(), defaultPasswordHash, u.role]
      );
    }

    for (const q of seed.questions) {
      await client.query(
        `INSERT INTO questions (id, kind, data)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [q.id, q.kind, JSON.stringify(q)]
      );
    }

    for (const c of seed.contests) {
      await client.query(
        `INSERT INTO contests (id, title, slug, join_code, strict_mode, description, organizer_id, organizer_name, created_at, rounds)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [
          c.id,
          c.title,
          c.slug,
          c.joinCode,
          c.strictMode,
          c.description,
          c.organizerId,
          c.organizerName,
          c.createdAt,
          JSON.stringify(c.rounds),
        ]
      );
    }

    for (const enr of seed.contestEnrollments) {
      await client.query(
        `INSERT INTO contest_enrollments (contest_id, user_id, joined_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (contest_id, user_id) DO NOTHING`,
        [enr.contestId, enr.userId, enr.joinedAt]
      );
    }

    for (const m of seed.mcqSubmissions) {
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

    for (const s of seed.codingSubmissions) {
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

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getPool(): Promise<Pool> {
  if (globalForPg.__turecodePool) {
    return globalForPg.__turecodePool;
  }
  if (!globalForPg.__turecodeInitPromise) {
    globalForPg.__turecodeInitPromise = (async () => {
      await startLocalPostgresIfNeeded();
      const pool = new Pool({
        connectionString: getConnectionString(),
        max: 15,
      });
      await runMigrationsAndSeed(pool);
      globalForPg.__turecodePool = pool;
      return pool;
    })().catch((err) => {
      globalForPg.__turecodeInitPromise = undefined;
      throw err;
    });
  }
  return globalForPg.__turecodeInitPromise;
}
