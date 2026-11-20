import { exec as execCb, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import type {
  CodingTestCase,
  CodingTestCaseResult,
  CodingVerdict,
  LanguageId,
} from "./types";

const execAsync = promisify(execCb);

export const SOCKET_PATH = "/tmp/sandbox.sock";
export const WORKSPACES_ROOT = "/tmp/workspaces";
export const DAEMON_SRC = path.join(process.cwd(), "sandbox", "daemon.c");
export const DAEMON_BIN = path.join(process.cwd(), "sandbox", "daemon");

/** HackerRank-style per-test-case execution time limits (ms) by language. */
export const LANGUAGE_TIME_LIMIT_MS: Record<LanguageId, number> = {
  c: 2000,
  cpp: 2000,
  java: 2500,
  python: 3000,
};

export interface SandboxRunResponse {
  status: "success" | "error";
  output: string;
  execution_time_ms: number;
  run_id: string;
  error: string | null;
  timed_out?: boolean;
}

export interface SubmissionEvaluationResponse {
  status: CodingVerdict;
  score: number;
  maxScore: number;
  passedCount: number;
  totalCount: number;
  executionTimeMs: number;
  runId: string;
  compileError?: string;
  testCaseResults: CodingTestCaseResult[];
}

function normalizeOutput(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .join("\n")
    .trim();
}

function canConnectSocket(socketPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const client = net.createConnection({ path: socketPath });
    const timer = setTimeout(() => {
      client.destroy();
      resolve(false);
    }, 300);

    client.on("connect", () => {
      clearTimeout(timer);
      client.end();
      resolve(true);
    });
    client.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

let bootPromise: Promise<boolean> | null = null;

export class SandboxedExecutor {
  public readonly socketPath: string;
  public readonly workspacesRoot: string;

  constructor(socketPath = SOCKET_PATH, workspacesRoot = WORKSPACES_ROOT) {
    this.socketPath = socketPath;
    this.workspacesRoot = workspacesRoot;
  }

  async ensureDaemonRunning(): Promise<boolean> {
    if (await canConnectSocket(this.socketPath)) {
      return true;
    }

    if (bootPromise) {
      return bootPromise;
    }

    bootPromise = (async () => {
      try {
        await fs.mkdir(this.workspacesRoot, { recursive: true });

        // Ensure daemon binary exists; compile from sandbox/daemon.c if missing
        let binExists = false;
        try {
          await fs.access(DAEMON_BIN);
          binExists = true;
        } catch {
          binExists = false;
        }

        if (!binExists) {
          await execAsync(`gcc -Wall -Wextra -O2 "${DAEMON_SRC}" -o "${DAEMON_BIN}"`, {
            timeout: 10000,
          });
        }

        const child = spawn(DAEMON_BIN, [], {
          detached: true,
          stdio: "ignore",
        });
        child.unref();

        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 50));
          if (await canConnectSocket(this.socketPath)) {
            return true;
          }
        }
        return false;
      } catch {
        return false;
      } finally {
        bootPromise = null;
      }
    })();

    return bootPromise;
  }

  async checkHealth(): Promise<{
    socketActive: boolean;
    socketPath: string;
    workspacesRoot: string;
    daemonBinaryExists: boolean;
  }> {
    const socketActive = await this.ensureDaemonRunning();
    let daemonBinaryExists = false;
    try {
      await fs.access(DAEMON_BIN);
      daemonBinaryExists = true;
    } catch {
      daemonBinaryExists = false;
    }
    return {
      socketActive,
      socketPath: this.socketPath,
      workspacesRoot: this.workspacesRoot,
      daemonBinaryExists,
    };
  }

  private async prepareWorkspace(
    language: LanguageId,
    sourceCode: string,
    workspaceDir: string
  ): Promise<{ ok: true; execCmd: string[] } | { ok: false; error: string }> {
    await fs.mkdir(workspaceDir, { recursive: true });

    if (language === "python") {
      const sourceFile = path.join(workspaceDir, "script.py");
      await fs.writeFile(sourceFile, sourceCode, "utf-8");
      return { ok: true, execCmd: ["/usr/bin/python3", sourceFile] };
    }

    if (language === "c") {
      const sourceFile = path.join(workspaceDir, "main.c");
      await fs.writeFile(sourceFile, sourceCode, "utf-8");
      try {
        await execAsync("gcc -O2 main.c -o a.out", {
          cwd: workspaceDir,
          timeout: 12000,
          maxBuffer: 2 * 1024 * 1024,
        });
        return { ok: true, execCmd: [path.join(workspaceDir, "a.out")] };
      } catch (err: unknown) {
        const e = err as { stderr?: string; stdout?: string; message?: string };
        return {
          ok: false,
          error: (e.stderr || e.stdout || e.message || "C compilation failed").trim(),
        };
      }
    }

    if (language === "cpp") {
      const sourceFile = path.join(workspaceDir, "main.cpp");
      await fs.writeFile(sourceFile, sourceCode, "utf-8");
      try {
        await execAsync("g++ -O2 main.cpp -o a.out", {
          cwd: workspaceDir,
          timeout: 12000,
          maxBuffer: 2 * 1024 * 1024,
        });
        return { ok: true, execCmd: [path.join(workspaceDir, "a.out")] };
      } catch (err: unknown) {
        const e = err as { stderr?: string; stdout?: string; message?: string };
        return {
          ok: false,
          error: (e.stderr || e.stdout || e.message || "C++ compilation failed").trim(),
        };
      }
    }

    if (language === "java") {
      const sourceFile = path.join(workspaceDir, "Main.java");
      await fs.writeFile(sourceFile, sourceCode, "utf-8");
      try {
        await execAsync("javac --enable-preview --source 27 Main.java || javac Main.java", {
          cwd: workspaceDir,
          timeout: 15000,
          maxBuffer: 2 * 1024 * 1024,
        });
        return {
          ok: true,
          execCmd: [
            "/usr/bin/java",
            "-Xmx256m",
            "-Xms32m",
            "--enable-preview",
            "-cp",
            workspaceDir,
            "Main",
          ],
        };
      } catch (err: unknown) {
        const e = err as { stderr?: string; stdout?: string; message?: string };
        return {
          ok: false,
          error: (e.stderr || e.stdout || e.message || "Java compilation failed").trim(),
        };
      }
    }

    return { ok: false, error: `Unsupported language: ${language}` };
  }

  async executeSocket(
    execCmd: string[],
    inputData: string,
    timeoutMs = 2500
  ): Promise<{
    ok: boolean;
    output: string;
    executionTimeMs: number;
    timedOut: boolean;
    runtimeError: boolean;
    error?: string;
  }> {
    const start = performance.now();

    return new Promise((resolve) => {
      const client = net.createConnection({ path: this.socketPath });
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      const MAX_BYTES = 1024 * 1024; // 1MB output cap
      let settled = false;
      let timedOut = false;

      const finish = (socketOk: boolean, socketErr?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const executionTimeMs = Math.round((performance.now() - start) * 100) / 100;
        let output = Buffer.concat(chunks).toString("utf-8");
        let ok = socketOk;
        let runtimeError = false;
        let error = socketErr;

        if (output.includes("__SANDBOX_TLE__")) {
          output = output.replace(/\n?__SANDBOX_TLE__\n?/g, "");
          timedOut = true;
          ok = false;
          error = "Time Limit Exceeded";
        }

        if (output.includes("__SANDBOX_RUNTIME_SIGNAL__:")) {
          output = output.replace(/\n?__SANDBOX_RUNTIME_SIGNAL__:\d+\n?/g, "");
          runtimeError = true;
          ok = false;
          error = error || "Runtime Error (terminated by signal)";
        }

        if (output.includes("__SANDBOX_EXIT_CODE__:")) {
          output = output.replace(/\n?__SANDBOX_EXIT_CODE__:\d+\n?/g, "");
          runtimeError = true;
          ok = false;
          error = error || "Runtime Error (non-zero exit status)";
        }

        if (executionTimeMs >= timeoutMs) {
          timedOut = true;
          ok = false;
          error = "Time Limit Exceeded";
        }

        resolve({ ok, output, executionTimeMs, timedOut, runtimeError, error });
      };

      const timer = setTimeout(() => {
        timedOut = true;
        client.destroy();
        finish(false, "Time Limit Exceeded (sandbox execution timed out)");
      }, timeoutMs);

      client.on("connect", () => {
        const header = execCmd.join("|");
        const payload = `${header}\n${inputData ?? ""}`;
        client.end(payload, "utf-8");
      });

      client.on("data", (chunk: Buffer) => {
        if (totalBytes < MAX_BYTES) {
          const remaining = MAX_BYTES - totalBytes;
          chunks.push(chunk.length > remaining ? chunk.subarray(0, remaining) : chunk);
          totalBytes += chunk.length;
        }
      });

      client.on("end", () => {
        finish(true);
      });

      client.on("close", () => {
        finish(true);
      });

      client.on("error", (err) => {
        finish(false, err.message);
      });
    });
  }

  async runCode(
    language: LanguageId,
    sourceCode: string,
    inputData = ""
  ): Promise<SandboxRunResponse> {
    const runId = crypto.randomUUID();
    const workspaceDir = path.join(this.workspacesRoot, runId);
    const totalStart = performance.now();

    const daemonReady = await this.ensureDaemonRunning();
    if (!daemonReady) {
      return {
        status: "error",
        output: "Sandbox C Fork-Server daemon is not reachable on /tmp/sandbox.sock",
        execution_time_ms: 0,
        run_id: runId,
        error: "Sandbox daemon unavailable",
      };
    }

    try {
      const prepared = await this.prepareWorkspace(language, sourceCode, workspaceDir);
      if (!prepared.ok) {
        return {
          status: "error",
          output: prepared.error,
          execution_time_ms: Math.round((performance.now() - totalStart) * 100) / 100,
          run_id: runId,
          error: prepared.error,
        };
      }

      const timeLimitMs = LANGUAGE_TIME_LIMIT_MS[language] ?? 2500;
      const execRes = await this.executeSocket(prepared.execCmd, inputData, timeLimitMs);
      if (execRes.timedOut) {
        return {
          status: "error",
          output: execRes.output || "Time Limit Exceeded",
          execution_time_ms: execRes.executionTimeMs,
          run_id: runId,
          error: execRes.error || "Time Limit Exceeded",
          timed_out: true,
        };
      }

      if (!execRes.ok) {
        return {
          status: "error",
          output: execRes.output || execRes.error || "Execution failed",
          execution_time_ms: execRes.executionTimeMs,
          run_id: runId,
          error: execRes.error || "Execution failed",
        };
      }

      return {
        status: "success",
        output: execRes.output,
        execution_time_ms: execRes.executionTimeMs,
        run_id: runId,
        error: null,
      };
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async evaluateSubmission(
    language: LanguageId,
    fullSourceCode: string,
    testCases: CodingTestCase[]
  ): Promise<SubmissionEvaluationResponse> {
    const runId = crypto.randomUUID();
    const workspaceDir = path.join(this.workspacesRoot, runId);
    const maxScore = testCases.reduce((acc, tc) => acc + tc.points, 0);

    const daemonReady = await this.ensureDaemonRunning();
    if (!daemonReady) {
      return {
        status: "Runtime Error",
        score: 0,
        maxScore,
        passedCount: 0,
        totalCount: testCases.length,
        executionTimeMs: 0,
        runId,
        compileError: "Sandbox C Fork-Server daemon is not reachable on /tmp/sandbox.sock",
        testCaseResults: [],
      };
    }

    try {
      const prepared = await this.prepareWorkspace(language, fullSourceCode, workspaceDir);
      if (!prepared.ok) {
        return {
          status: "Compilation Error",
          score: 0,
          maxScore,
          passedCount: 0,
          totalCount: testCases.length,
          executionTimeMs: 0,
          runId,
          compileError: prepared.error,
          testCaseResults: testCases.map((tc) => ({
            testCaseId: tc.id,
            isSample: tc.isSample,
            passed: false,
            status: "Compilation Error",
            executionTimeMs: 0,
          })),
        };
      }

      // Execute all testcases concurrently over /tmp/sandbox.sock with per-testcase TLE enforcement
      const timeLimitMs = LANGUAGE_TIME_LIMIT_MS[language] ?? 2500;
      const results = await Promise.all(
        testCases.map(async (tc): Promise<CodingTestCaseResult & { _points: number }> => {
          const res = await this.executeSocket(prepared.execCmd, tc.input, timeLimitMs);
          const actualNorm = normalizeOutput(res.output);
          const expectedNorm = normalizeOutput(tc.expectedOutput);

          let tcStatus: CodingTestCaseResult["status"] = "Wrong Answer";
          let passed = false;

          if (res.timedOut || res.executionTimeMs >= timeLimitMs) {
            tcStatus = "Time Limit Exceeded";
          } else if (
            res.runtimeError ||
            !res.ok ||
            actualNorm.includes("Traceback (most recent call last)") ||
            actualNorm.includes("Exception in thread") ||
            actualNorm.includes("Segmentation fault") ||
            actualNorm.includes("Aborted (core dumped)")
          ) {
            tcStatus = "Runtime Error";
          } else if (actualNorm === expectedNorm) {
            passed = true;
            tcStatus = "Passed";
          }

          return {
            testCaseId: tc.id,
            isSample: tc.isSample,
            passed,
            status: tcStatus,
            executionTimeMs: res.executionTimeMs,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: res.output,
            _points: passed ? tc.points : 0,
          };
        })
      );

      let score = 0;
      let passedCount = 0;
      let totalTime = 0;
      let hasTle = false;
      let hasRuntimeErr = false;

      const testCaseResults: CodingTestCaseResult[] = results.map(({ _points, ...rest }) => {
        score += _points;
        if (rest.passed) passedCount++;
        totalTime += rest.executionTimeMs;
        if (rest.status === "Time Limit Exceeded") hasTle = true;
        if (rest.status === "Runtime Error") hasRuntimeErr = true;
        return rest;
      });

      let status: CodingVerdict;
      if (passedCount === testCases.length && testCases.length > 0) {
        status = "Accepted";
      } else if (hasTle) {
        status = "Time Limit Exceeded";
      } else if (hasRuntimeErr) {
        status = "Runtime Error";
      } else if (passedCount > 0) {
        status = "Partial";
      } else {
        status = "Wrong Answer";
      }

      return {
        status,
        score,
        maxScore,
        passedCount,
        totalCount: testCases.length,
        executionTimeMs: Math.round(totalTime * 100) / 100,
        runId,
        testCaseResults,
      };
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

export const sandboxExecutor = new SandboxedExecutor();
