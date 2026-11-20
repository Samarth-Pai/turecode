import { closeDb, getDb } from "./postgres";
import * as schema from "./schema";

async function main() {
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
  });

  console.log(
    "[turecode:db] Cleared all rows from all tables. Run `bun run db:seed` to re-seed demo data or `bun run db:restore` to load a backup."
  );

  await closeDb();
}

main().catch(async (err) => {
  console.error("[turecode:db] Clear failed:", err);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
