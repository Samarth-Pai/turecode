import { closeDb, getDb } from "./postgres";
import { contests, questions, users } from "./schema";

async function main() {
  const db = await getDb();
  const [userRows, questionRows, contestRows] = await Promise.all([
    db.select({ id: users.id }).from(users),
    db.select({ id: questions.id }).from(questions),
    db.select({ id: contests.id }).from(contests),
  ]);

  console.log(
    `[turecode:db] PostgreSQL ready via Drizzle (${userRows.length} users, ${questionRows.length} questions, ${contestRows.length} contests).`
  );
  await closeDb();
}

main().catch((err) => {
  console.error("[turecode:db] Error:", err);
  process.exit(1);
});
