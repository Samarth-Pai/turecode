import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type {
  CodingSubmission,
  CodingTestCaseResult,
  LanguageId,
  Question,
  Round,
  UserRole,
} from "./types";

/** Platform user accounts (moderators and participants). */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  handle: text("handle").notNull(),
  email: text("email").notNull().unique("users_email_key"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<UserRole>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Cookie-backed authentication sessions. */
export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/** Reusable bank of MCQ and DSL-stubbed coding questions. */
export const questions = pgTable("questions", {
  id: text("id").primaryKey(),
  kind: text("kind").$type<Question["kind"]>().notNull(),
  data: jsonb("data").$type<Question>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Contests containing join codes, proctoring mode, and multi-round schedules. */
export const contests = pgTable("contests", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  joinCode: text("join_code").notNull().unique("contests_join_code_key"),
  strictMode: boolean("strict_mode").notNull().default(false),
  description: text("description").notNull(),
  organizerId: text("organizer_id").notNull(),
  organizerName: text("organizer_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  rounds: jsonb("rounds").$type<Round[]>().notNull(),
});

/** Strict-mode tab-switch and fullscreen exit violation counters per user/contest. */
export const proctoringViolations = pgTable(
  "proctoring_violations",
  {
    contestId: text("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    count: integer("count").notNull().default(0),
    lastReason: text("last_reason").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.contestId, table.userId] })]
);

/** Per-question start timestamps used to measure exact time taken to solve each question. */
export const questionAttempts = pgTable(
  "question_attempts",
  {
    contestId: text("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    roundId: text("round_id").notNull(),
    questionId: text("question_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.contestId, table.roundId, table.questionId, table.userId],
    }),
  ]
);

/** Moderator manual round-level score overrides for leaderboard fairness/regrades. */
export const scoreOverrides = pgTable(
  "score_overrides",
  {
    contestId: text("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    roundId: text("round_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    overrideScore: integer("override_score").notNull(),
    reason: text("reason").notNull().default(""),
    updatedBy: text("updated_by").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.contestId, table.roundId, table.userId] }),
  ]
);

/** Participant contest enrollments unlocked via joining codes. */
export const contestEnrollments = pgTable(
  "contest_enrollments",
  {
    contestId: text("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.contestId, table.userId] })]
);

/** Evaluated multiple-choice responses submitted by participants. */
export const mcqSubmissions = pgTable("mcq_submissions", {
  id: text("id").primaryKey(),
  contestId: text("contest_id").notNull(),
  roundId: text("round_id").notNull(),
  questionId: text("question_id").notNull(),
  userId: text("user_id").notNull(),
  selectedOptionId: text("selected_option_id").notNull(),
  isCorrect: boolean("is_correct").notNull(),
  score: integer("score").notNull(),
  timeTakenSeconds: integer("time_taken_seconds").notNull().default(0),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
});

/** Code execution records from the rootless Landlock fork-server sandbox. */
export const codingSubmissions = pgTable("coding_submissions", {
  id: text("id").primaryKey(),
  contestId: text("contest_id").notNull(),
  roundId: text("round_id").notNull(),
  questionId: text("question_id").notNull(),
  userId: text("user_id").notNull(),
  language: text("language").$type<LanguageId>().notNull(),
  sourceCode: text("source_code").notNull(),
  fullSourceCode: text("full_source_code").notNull(),
  status: text("status").$type<CodingSubmission["status"]>().notNull(),
  score: integer("score").notNull(),
  maxScore: integer("max_score").notNull(),
  passedCount: integer("passed_count").notNull(),
  totalCount: integer("total_count").notNull(),
  executionTimeMs: doublePrecision("execution_time_ms").notNull(),
  timeTakenSeconds: integer("time_taken_seconds").notNull().default(0),
  runId: text("run_id").notNull(),
  compileError: text("compile_error"),
  testCaseResults: jsonb("test_case_results")
    .$type<CodingTestCaseResult[]>()
    .notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
});
