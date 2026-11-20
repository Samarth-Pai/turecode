import fs from "node:fs/promises";
import path from "node:path";
import { closeDb, getDb } from "./postgres";
import * as schema from "./schema";

async function main() {
  const outArg = process.argv[2] || "turecode-backup.json";
  const outPath = path.resolve(process.cwd(), outArg);

  const db = await getDb();

  const [
    users,
    sessions,
    questions,
    contests,
    contestEnrollments,
    proctoringViolations,
    questionAttempts,
    scoreOverrides,
    mcqSubmissions,
    codingSubmissions,
  ] = await Promise.all([
    db.select().from(schema.users),
    db.select().from(schema.sessions),
    db.select().from(schema.questions),
    db.select().from(schema.contests),
    db.select().from(schema.contestEnrollments),
    db.select().from(schema.proctoringViolations),
    db.select().from(schema.questionAttempts),
    db.select().from(schema.scoreOverrides),
    db.select().from(schema.mcqSubmissions),
    db.select().from(schema.codingSubmissions),
  ]);

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tables: {
      users,
      sessions,
      questions,
      contests,
      contestEnrollments,
      proctoringViolations,
      questionAttempts,
      scoreOverrides,
      mcqSubmissions,
      codingSubmissions,
    },
  };

  await fs.writeFile(outPath, JSON.stringify(payload, null, 2), "utf8");

  console.log(
    `[turecode:db] Exported backup to ${outArg} (` +
      `${users.length} users, ${questions.length} questions, ${contests.length} contests, ` +
      `${mcqSubmissions.length} MCQ submissions, ${codingSubmissions.length} coding submissions).`
  );

  await closeDb();
}

main().catch(async (err) => {
  console.error("[turecode:db] Dump failed:", err);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
