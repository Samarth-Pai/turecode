import { NextResponse } from "next/server";
import { sandboxExecutor } from "@/lib/sandbox";
import type { LanguageId } from "@/lib/types";

const SAMPLE_SNIPPETS: Record<LanguageId, { code: string; input: string }> = {
  c: {
    code: `#include <stdio.h>
int main() {
    int a, b;
    if (scanf("%d %d", &a, &b) == 2) printf("%d\\n", a + b);
    return 0;
}`,
    input: "19 23\n",
  },
  cpp: {
    code: `#include <iostream>
using namespace std;
int main() {
    int a, b;
    if (cin >> a >> b) cout << (a + b) << "\\n";
    return 0;
}`,
    input: "19 23\n",
  },
  java: {
    code: `import java.util.*;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int a = sc.nextInt(), b = sc.nextInt();
        System.out.println(a + b);
    }
}`,
    input: "19 23\n",
  },
  python: {
    code: `a, b = map(int, input().split())
print(a + b)`,
    input: "19 23\n",
  },
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const concurrency = Math.min(40, Math.max(4, Number(body.concurrency) || 12));
    const langs: LanguageId[] = ["c", "cpp", "java", "python"];

    const wallStart = performance.now();
    const tasks = Array.from({ length: concurrency }, (_, idx) => {
      const lang = langs[idx % langs.length];
      const snippet = SAMPLE_SNIPPETS[lang];
      return sandboxExecutor.runCode(lang, snippet.code, snippet.input).then((res) => ({
        language: lang,
        ok: res.status === "success" && res.output.trim() === "42",
        executionTimeMs: res.execution_time_ms,
        output: res.output.trim(),
        error: res.error,
      }));
    });

    const results = await Promise.all(tasks);
    const totalWallMs = Math.round((performance.now() - wallStart) * 100) / 100;
    const successCount = results.filter((r) => r.ok).length;

    return NextResponse.json({
      concurrency,
      totalWallMs,
      throughputRps: Math.round((concurrency / (totalWallMs / 1000)) * 100) / 100,
      successCount,
      errorCount: concurrency - successCount,
      results,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Benchmark failed" },
      { status: 500 }
    );
  }
}
