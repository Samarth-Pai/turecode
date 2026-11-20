export type LanguageId = "c" | "cpp" | "java" | "python";

export const SUPPORTED_LANGUAGES: {
  id: LanguageId;
  label: string;
  extension: string;
  runtimeLabel: string;
}[] = [
  { id: "c", label: "C (GCC 16)", extension: "c", runtimeLabel: "gcc -O2" },
  { id: "cpp", label: "C++ (G++ 16)", extension: "cpp", runtimeLabel: "g++ -O2" },
  { id: "java", label: "Java (OpenJDK 27)", extension: "java", runtimeLabel: "javac + java -Xmx256m" },
  { id: "python", label: "Python 3", extension: "py", runtimeLabel: "python3" },
];

export interface CodeStubBundle {
  head: string;
  body: string;
  tail: string;
}

export type UserRole = "moderator" | "participant";

export interface User {
  id: string;
  name: string;
  handle: string;
  email: string;
  role: UserRole;
}

export interface DbUser extends User {
  passwordHash: string;
}

export interface MCQOption {
  id: string;
  text: string;
}

export interface MCQQuestion {
  id: string;
  kind: "mcq";
  /** Optional legacy label; MCQs primarily live inside round sections without individual titles. */
  title?: string;
  sectionName?: string;
  prompt: string;
  options: MCQOption[];
  correctOptionId: string;
  points: number;
  negativePoints: number;
  difficulty: "Easy" | "Medium" | "Hard";
  explanation?: string;
  tags: string[];
}

export interface CodingTestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isSample: boolean;
  points: number;
  explanation?: string;
}

export interface CodingQuestion {
  id: string;
  kind: "coding";
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  points: number;
  description: string;
  inputFormat: string;
  constraints: string;
  outputFormat: string;
  tags: string[];
  useDslStubs: boolean;
  dslSource: string;
  codeStubs: Record<LanguageId, CodeStubBundle>;
  sampleSolutions?: Partial<Record<LanguageId, string>>;
  testCases: CodingTestCase[];
}

export type Question = MCQQuestion | CodingQuestion;

export type RoundType = "mcq" | "coding";

export type RoundScheduleStatus = "UPCOMING" | "ACTIVE" | "ENDED";

export interface McqSection {
  id: string;
  title: string;
  description?: string;
  questionIds: string[];
}

export interface Round {
  id: string;
  contestId: string;
  title: string;
  description: string;
  type: RoundType;
  order: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  questionIds: string[];
  sections?: McqSection[];
}

export interface Contest {
  id: string;
  title: string;
  slug: string;
  joinCode: string;
  strictMode: boolean;
  description: string;
  organizerId: string;
  organizerName: string;
  createdAt: string;
  rounds: Round[];
  enrolledUserIds?: string[];
}

export interface ProctoringViolation {
  contestId: string;
  userId: string;
  count: number;
  lastReason: string;
  updatedAt: string;
}

export interface QuestionAttempt {
  contestId: string;
  roundId: string;
  questionId: string;
  userId: string;
  startedAt: string;
}

export interface ScoreOverride {
  contestId: string;
  roundId: string;
  userId: string;
  overrideScore: number;
  reason?: string;
  updatedBy?: string;
  updatedAt: string;
}

export interface MCQSubmission {
  id: string;
  contestId: string;
  roundId: string;
  questionId: string;
  userId: string;
  selectedOptionId: string;
  isCorrect: boolean;
  score: number;
  timeTakenSeconds?: number;
  submittedAt: string;
}

export interface CodingTestCaseResult {
  testCaseId: string;
  isSample: boolean;
  passed: boolean;
  status:
    | "Passed"
    | "Wrong Answer"
    | "Runtime Error"
    | "Time Limit Exceeded"
    | "Compilation Error";
  executionTimeMs: number;
  input?: string;
  expectedOutput?: string;
  actualOutput?: string;
}

export type CodingVerdict =
  | "Accepted"
  | "Partial"
  | "Wrong Answer"
  | "Compilation Error"
  | "Runtime Error"
  | "Time Limit Exceeded"
  | "Submitted";

export interface CodingSubmission {
  id: string;
  contestId: string;
  roundId: string;
  questionId: string;
  userId: string;
  language: LanguageId;
  sourceCode: string;
  fullSourceCode: string;
  status: CodingVerdict;
  score: number;
  maxScore: number;
  passedCount: number;
  totalCount: number;
  executionTimeMs: number;
  timeTakenSeconds?: number;
  runId: string;
  compileError?: string;
  testCaseResults: CodingTestCaseResult[];
  submittedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userHandle: string;
  totalScore: number;
  maxPossibleScore: number;
  roundScores: Record<string, number>;
  originalRoundScores?: Record<string, number>;
  overriddenRoundIds?: string[];
  problemsAttempted: number;
  problemsSolved: number;
  totalSolveTimeSeconds: number;
  questionSolveTimes: Record<string, number>;
  totalExecutionTimeMs: number;
  lastSubmittedAt: string | null;
}

export interface ContestEnrollment {
  contestId: string;
  userId: string;
  joinedAt: string;
}

export interface DatabaseSchema {
  users: User[];
  questions: Question[];
  contests: Contest[];
  contestEnrollments: ContestEnrollment[];
  mcqSubmissions: MCQSubmission[];
  codingSubmissions: CodingSubmission[];
  questionAttempts?: QuestionAttempt[];
  scoreOverrides?: ScoreOverride[];
}

export function getRoundStatus(
  round: Pick<Round, "startTime" | "endTime">,
  nowMs = Date.now()
): RoundScheduleStatus {
  const start = new Date(round.startTime).getTime();
  const end = new Date(round.endTime).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return "ACTIVE";
  if (nowMs < start) return "UPCOMING";
  if (nowMs > end) return "ENDED";
  return "ACTIVE";
}

export function stitchCodeStub(bundle: CodeStubBundle, bodyCode: string): string {
  const parts = [bundle.head?.trimEnd(), bodyCode, bundle.tail?.trimStart()].filter(
    (p): p is string => Boolean(p && p.length > 0)
  );
  return parts.join("\n\n") + "\n";
}

export function getQuestionSummary(q: Question, maxLen = 72): string {
  if (q.kind === "coding") return q.title;
  const raw = q.prompt.replace(/\$\$?/g, "").replace(/\s+/g, " ").trim();
  return raw.length > maxLen ? `${raw.slice(0, maxLen - 1)}…` : raw;
}

export function formatDurationSeconds(totalSec: number): string {
  if (!totalSec || totalSec <= 0) return "—";
  const s = Math.round(totalSec);
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  if (mins === 0) return `${rem}s`;
  const hrs = Math.floor(mins / 60);
  if (hrs === 0) return `${mins}m ${String(rem).padStart(2, "0")}s`;
  return `${hrs}h ${String(mins % 60).padStart(2, "0")}m`;
}
