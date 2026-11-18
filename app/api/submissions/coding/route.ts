import crypto from "node:crypto";
import { connection, NextRequest, NextResponse } from "next/server";
import { computeLeaderboard, mutateDb, readDb } from "@/lib/db";
import { sandboxExecutor } from "@/lib/sandbox";
import {
  getRoundStatus,
  stitchCodeStub,
  type CodingSubmission,
  type LanguageId,
} from "@/lib/types";

const ALLOWED_LANGUAGES = new Set<LanguageId>(["c", "cpp", "java", "python"]);

export async function GET(request: NextRequest) {
  await connection();
  const contestId = request.nextUrl.searchParams.get("contestId");
  const roundId = request.nextUrl.searchParams.get("roundId");
  const questionId = request.nextUrl.searchParams.get("questionId");
  const userId = request.nextUrl.searchParams.get("userId");

  const db = await readDb();
  const reqUser = userId ? db.users.find((u) => u.id === userId) : null;
  const isMod = reqUser?.role === "moderator";

  const submissions = db.codingSubmissions
    .filter((s) => {
      if (contestId && s.contestId !== contestId) return false;
      if (roundId && s.roundId !== roundId) return false;
      if (questionId && s.questionId !== questionId) return false;
      if (userId && s.userId !== userId) return false;
      return true;
    })
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .map((s) =>
      isMod
        ? s
        : {
            id: s.id,
            contestId: s.contestId,
            roundId: s.roundId,
            questionId: s.questionId,
            userId: s.userId,
            language: s.language,
            sourceCode: s.sourceCode,
            status: "Submitted",
            submittedAt: s.submittedAt,
          }
    );

  return NextResponse.json({ submissions });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const contestId = String(body.contestId ?? "");
    const roundId = String(body.roundId ?? "");
    const questionId = String(body.questionId ?? "");
    const userId = String(body.userId ?? "");
    const language = String(body.language ?? "").toLowerCase().trim() as LanguageId;
    const sourceCode = String(body.sourceCode ?? "");
    const mode = body.mode === "run" ? "run" : "submit";
    const useCustomInput = Boolean(body.useCustomInput);
    const customInput = typeof body.customInput === "string" ? body.customInput : "";

    if (!ALLOWED_LANGUAGES.has(language)) {
      return NextResponse.json(
        { error: "Only c, cpp, java, and python are supported in the Rootless Code Sandbox." },
        { status: 400 }
      );
    }

    if (!contestId || !roundId || !questionId || !userId) {
      return NextResponse.json(
        { error: "contestId, roundId, questionId, and userId are required." },
        { status: 400 }
      );
    }

    const db = await readDb();
    const contest = db.contests.find((c) => c.id === contestId);
    const round = contest?.rounds.find((r) => r.id === roundId);
    const question = db.questions.find(
      (q) => q.id === questionId && q.kind === "coding"
    );
    const user = db.users.find((u) => u.id === userId);

    if (!contest || !round || !question || question.kind !== "coding") {
      return NextResponse.json(
        { error: "Contest, round, or coding question not found." },
        { status: 404 }
      );
    }

    const isMod = user?.role === "moderator" || Boolean(body.moderatorOverride);
    const scheduleStatus = getRoundStatus(round);
    if (mode === "submit" && scheduleStatus !== "ACTIVE" && !isMod) {
      return NextResponse.json(
        {
          error: `Round is ${scheduleStatus}. Official submissions are only accepted while the round schedule is ACTIVE.`,
        },
        { status: 403 }
      );
    }

    const stub = question.codeStubs[language];
    const fullSourceCode =
      question.useDslStubs && stub
        ? stitchCodeStub(stub, sourceCode)
        : sourceCode;

    if (mode === "run") {
      if (useCustomInput) {
        const res = await sandboxExecutor.runCode(language, fullSourceCode, customInput);
        return NextResponse.json({
          mode: "run",
          customRun: true,
          status: res.status === "success" ? "Executed" : res.timed_out ? "Time Limit Exceeded" : "Error",
          output: res.output,
          error: res.error,
          executionTimeMs: res.execution_time_ms,
          runId: res.run_id,
        });
      }

      const sampleCases = question.testCases.filter((tc) => tc.isSample);
      const targetCases = sampleCases.length > 0 ? sampleCases : question.testCases.slice(0, 1);
      const evalRes = await sandboxExecutor.evaluateSubmission(
        language,
        fullSourceCode,
        targetCases
      );

      return NextResponse.json({
        mode: "run",
        customRun: false,
        ...evalRes,
      });
    }

    // Official submission against all test cases (sample + hidden)
    const evalRes = await sandboxExecutor.evaluateSubmission(
      language,
      fullSourceCode,
      question.testCases
    );

    const submission: CodingSubmission = {
      id: `sub-code-${crypto.randomUUID().slice(0, 8)}`,
      contestId,
      roundId,
      questionId,
      userId,
      language,
      sourceCode,
      fullSourceCode,
      status: evalRes.status,
      score: evalRes.score,
      maxScore: evalRes.maxScore,
      passedCount: evalRes.passedCount,
      totalCount: evalRes.totalCount,
      executionTimeMs: evalRes.executionTimeMs,
      runId: evalRes.runId,
      compileError: evalRes.compileError,
      testCaseResults: evalRes.testCaseResults,
      submittedAt: new Date().toISOString(),
    };

    const leaderboard = await mutateDb((mutDb) => {
      mutDb.codingSubmissions.push(submission);
      return computeLeaderboard(mutDb, contestId);
    });

    if (!isMod) {
      return NextResponse.json({
        mode: "submit",
        submitted: true,
        submission: {
          id: submission.id,
          contestId: submission.contestId,
          roundId: submission.roundId,
          questionId: submission.questionId,
          userId: submission.userId,
          language: submission.language,
          sourceCode: submission.sourceCode,
          status: "Submitted",
          submittedAt: submission.submittedAt,
        },
      });
    }

    return NextResponse.json({
      mode: "submit",
      submitted: true,
      submission: {
        ...submission,
        testCaseResults: evalRes.testCaseResults,
      },
      leaderboard: leaderboard.entries,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to evaluate code submission" },
      { status: 500 }
    );
  }
}
