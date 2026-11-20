import fs from "node:fs/promises";
import path from "node:path";
import { closeDb, getDb } from "./postgres";
import * as schema from "./schema";

interface BackupPayload {
  version: number;
  exportedAt: string;
  tables: {
    users: (typeof schema.users.$inferInsert)[];
    sessions: (typeof schema.sessions.$inferInsert)[];
    questions: (typeof schema.questions.$inferInsert)[];
    contests: (typeof schema.contests.$inferInsert)[];
    contestEnrollments: (typeof schema.contestEnrollments.$inferInsert)[];
    proctoringViolations: (typeof schema.proctoringViolations.$inferInsert)[];
    questionAttempts: (typeof schema.questionAttempts.$inferInsert)[];
    scoreOverrides: (typeof schema.scoreOverrides.$inferInsert)[];
    mcqSubmissions: (typeof schema.mcqSubmissions.$inferInsert)[];
    codingSubmissions: (typeof schema.codingSubmissions.$inferInsert)[];
  };
}

function toDate(value: Date | string | undefined): Date {
  return value instanceof Date ? value : new Date(value ?? Date.now());
}

async function main() {
  const inArg = process.argv[2] || "turecode-backup.json";
  const inPath = path.resolve(process.cwd(), inArg);

  const raw = await fs.readFile(inPath, "utf8");
  const payload = JSON.parse(raw) as BackupPayload;
  if (!payload?.tables) {
    throw new Error(`Invalid backup file format in ${inArg}`);
  }

  const t = payload.tables;
  const db = await getDb();

  await db.transaction(async (tx) => {
    // Delete child tables first to satisfy foreign keys cleanly
    await tx.delete(schema.codingSubmissions);
    await tx.delete(schema.mcqSubmissions);
    await tx.delete(schema.scoreOverrides);
    await tx.delete(schema.questionAttempts);
    await tx.delete(schema.proctoringViolations);
    await tx.delete(schema.contestEnrollments);
    await tx.delete(schema.sessions);
    await tx.delete(schema.contests);
    await tx.delete(schema.questions);
    await tx.delete(schema.users);

    if (t.users?.length) {
      await tx.insert(schema.users).values(
        t.users.map((u) => ({ ...u, createdAt: toDate(u.createdAt) }))
      );
    }
    if (t.sessions?.length) {
      await tx.insert(schema.sessions).values(
        t.sessions.map((s) => ({
          ...s,
          createdAt: toDate(s.createdAt),
          expiresAt: toDate(s.expiresAt),
        }))
      );
    }
    if (t.questions?.length) {
      await tx.insert(schema.questions).values(
        t.questions.map((q) => ({ ...q, createdAt: toDate(q.createdAt) }))
      );
    }
    if (t.contests?.length) {
      await tx.insert(schema.contests).values(
        t.contests.map((c) => ({ ...c, createdAt: toDate(c.createdAt) }))
      );
    }
    if (t.contestEnrollments?.length) {
      await tx.insert(schema.contestEnrollments).values(
        t.contestEnrollments.map((e) => ({ ...e, joinedAt: toDate(e.joinedAt) }))
      );
    }
    if (t.proctoringViolations?.length) {
      await tx.insert(schema.proctoringViolations).values(
        t.proctoringViolations.map((v) => ({ ...v, updatedAt: toDate(v.updatedAt) }))
      );
    }
    if (t.questionAttempts?.length) {
      await tx.insert(schema.questionAttempts).values(
        t.questionAttempts.map((a) => ({ ...a, startedAt: toDate(a.startedAt) }))
      );
    }
    if (t.scoreOverrides?.length) {
      await tx.insert(schema.scoreOverrides).values(
        t.scoreOverrides.map((o) => ({ ...o, updatedAt: toDate(o.updatedAt) }))
      );
    }
    if (t.mcqSubmissions?.length) {
      await tx.insert(schema.mcqSubmissions).values(
        t.mcqSubmissions.map((m) => ({ ...m, submittedAt: toDate(m.submittedAt) }))
      );
    }
    if (t.codingSubmissions?.length) {
      await tx.insert(schema.codingSubmissions).values(
        t.codingSubmissions.map((c) => ({ ...c, submittedAt: toDate(c.submittedAt) }))
      );
    }
  });

  console.log(
    `[turecode:db] Restored backup from ${inArg} (` +
      `${t.users?.length ?? 0} users, ${t.questions?.length ?? 0} questions, ${t.contests?.length ?? 0} contests, ` +
      `${t.mcqSubmissions?.length ?? 0} MCQ submissions, ${t.codingSubmissions?.length ?? 0} coding submissions).`
  );

  await closeDb();
}

main().catch(async (err) => {
  console.error("[turecode:db] Restore failed:", err);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
