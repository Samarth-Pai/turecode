import { compileDslToStubs } from "./dsl";
import { stitchCodeStub, type CodingQuestion, type DatabaseSchema, type MCQQuestion } from "./types";

function makeCodingQuestion(
  base: Omit<CodingQuestion, "kind" | "codeStubs" | "useDslStubs">
): CodingQuestion {
  const compiled = compileDslToStubs(base.dslSource);
  return {
    ...base,
    kind: "coding",
    useDslStubs: true,
    codeStubs: compiled.stubs,
  };
}

export function getInitialSeedData(): DatabaseSchema {
  const now = Date.now();
  const h = (hours: number) => new Date(now + hours * 3600 * 1000).toISOString();

  const mcqQuestions: MCQQuestion[] = [
    {
      id: "mcq-1",
      kind: "mcq",
      title: "Time Complexity of Build-Heap",
      prompt:
        "What is the tight worst-case time complexity of building a binary heap from an unsorted array of N elements using Floyd's bottom-up heapify algorithm?",
      options: [
        { id: "a", text: "O(N log N)" },
        { id: "b", text: "O(N)" },
        { id: "c", text: "O(log N)" },
        { id: "d", text: "O(N^2)" },
      ],
      correctOptionId: "b",
      points: 25,
      negativePoints: 5,
      difficulty: "Easy",
      explanation: "Because most nodes are near the leaves and sift-down work decreases exponentially with height, bottom-up heap construction runs in O(N).",
      tags: ["Data Structures", "Heaps", "Complexity"],
    },
    {
      id: "mcq-2",
      kind: "mcq",
      title: "Linux Landlock LSM Isolation",
      prompt:
        "In the Rootless Code Sandbox daemon, which Linux system call applies the constructed Landlock filesystem ruleset to the calling child process before execve()?",
      options: [
        { id: "a", text: "chroot()" },
        { id: "b", text: "landlock_restrict_self()" },
        { id: "c", text: "setuid(0)" },
        { id: "d", text: "mount(--bind)" },
      ],
      correctOptionId: "b",
      points: 25,
      negativePoints: 5,
      difficulty: "Medium",
      explanation: "After PR_SET_NO_NEW_PRIVS, calling landlock_restrict_self(ruleset_fd, 0) enforces the Landlock LSM policy on the process and its descendants without root privileges.",
      tags: ["Linux", "Security", "Landlock"],
    },
    {
      id: "mcq-3",
      kind: "mcq",
      title: "Shortest Path with Negative Edge Weights",
      prompt:
        "Which single-source shortest path algorithm correctly handles graphs containing negative edge weights and can detect negative-weight cycles?",
      options: [
        { id: "a", text: "Dijkstra's Algorithm with Binary Heap" },
        { id: "b", text: "Breadth-First Search (BFS)" },
        { id: "c", text: "Bellman-Ford Algorithm" },
        { id: "d", text: "Kruskal's Algorithm" },
      ],
      correctOptionId: "c",
      points: 25,
      negativePoints: 5,
      difficulty: "Easy",
      explanation: "Bellman-Ford relaxes all edges V - 1 times and checks on the V-th pass for negative cycles.",
      tags: ["Graphs", "Algorithms"],
    },
    {
      id: "mcq-4",
      kind: "mcq",
      title: "POSIX Fork-Server Zombie Prevention",
      prompt:
        "How does the C Fork-Server daemon prevent defunct zombie processes from accumulating after thousands of sandboxed student code executions?",
      options: [
        { id: "a", text: "Calling sleep(1) after every fork()" },
        { id: "b", text: "Registering a SIGCHLD handler that loops waitpid(-1, NULL, WNOHANG)" },
        { id: "c", text: "Closing STDIN_FILENO in the parent process" },
        { id: "d", text: "Spawning a Python thread per connection" },
      ],
      correctOptionId: "b",
      points: 25,
      negativePoints: 5,
      difficulty: "Medium",
      explanation: "A non-blocking waitpid(-1, NULL, WNOHANG) loop inside the SIGCHLD handler reaps every terminated child asynchronously.",
      tags: ["Systems", "POSIX", "C"],
    },
    {
      id: "mcq-5",
      kind: "mcq",
      title: "BST Traversal Yielding Sorted Order",
      prompt:
        "Which depth-first traversal of a Binary Search Tree visits all node keys in non-decreasing sorted order?",
      options: [
        { id: "a", text: "Pre-order traversal" },
        { id: "b", text: "In-order traversal" },
        { id: "c", text: "Post-order traversal" },
        { id: "d", text: "Level-order traversal" },
      ],
      correctOptionId: "b",
      points: 20,
      negativePoints: 0,
      difficulty: "Easy",
      explanation: "In-order traversal visits Left subtree -> Root -> Right subtree, producing ascending keys in a BST.",
      tags: ["Trees", "BST"],
    },
    {
      id: "mcq-6",
      kind: "mcq",
      title: "Unix Domain Sockets vs TCP Loopback",
      prompt:
        "Why does the Rootless Code Sandbox communicate between the web layer and the C fork-server over /tmp/sandbox.sock instead of TCP localhost?",
      options: [
        { id: "a", text: "Unix Domain Sockets bypass the TCP/IP network stack for lower latency and avoid ephemeral port exhaustion" },
        { id: "b", text: "Unix Domain Sockets automatically encrypt payloads with TLS 1.3" },
        { id: "c", text: "TCP does not work on Linux kernels 5.13+" },
        { id: "d", text: "Unix Domain Sockets allow bypassing Landlock LSM" },
      ],
      correctOptionId: "a",
      points: 30,
      negativePoints: 5,
      difficulty: "Medium",
      explanation: "AF_UNIX stream sockets transfer data directly in kernel memory without TCP handshake, routing, or ephemeral port limits.",
      tags: ["Networking", "Systems", "IPC"],
    },
  ];

  const codingQuestions: CodingQuestion[] = [
    makeCodingQuestion({
      id: "code-1",
      title: "Maximum Subarray Sum",
      difficulty: "Easy",
      points: 100,
      description:
        "Given an integer array `arr` of length `n`, find the contiguous subarray (containing at least one element) which has the largest sum and return its sum.\n\nComplete the generated function stub — input parsing and output printing are handled automatically by the HackerRank-style DSL driver.",
      inputFormat:
        "The first line contains an integer `n`.\nThe second line contains `n` space-separated integers representing `arr`.",
      constraints: "1 <= n <= 10^5\n-10^4 <= arr[i] <= 10^4",
      outputFormat: "Return a single integer representing the maximum contiguous subarray sum.",
      tags: ["Arrays", "Kadane's Algorithm", "DP"],
      dslSource: `# Maximum Subarray Sum DSL
function(integer, maxSubarraySum, integer n, integer_array arr)
integer(n)
Array(integer, arr, n, single)
INVOKE(integer, result, maxSubarraySum, n, arr)
print(integer, result)`,
      sampleSolutions: {
        c: `int maxSubarraySum(int n, int* arr) {
    int best = arr[0];
    int curr = arr[0];
    for (int i = 1; i < n; i++) {
        curr = (curr + arr[i] > arr[i]) ? (curr + arr[i]) : arr[i];
        if (curr > best) best = curr;
    }
    return best;
}`,
        cpp: `int maxSubarraySum(int n, vector<int> arr) {
    int best = arr[0];
    int curr = arr[0];
    for (int i = 1; i < n; i++) {
        curr = max(arr[i], curr + arr[i]);
        best = max(best, curr);
    }
    return best;
}`,
        java: `class Result {
    public static int maxSubarraySum(int n, int[] arr) {
        int best = arr[0];
        int curr = arr[0];
        for (int i = 1; i < n; i++) {
            curr = Math.max(arr[i], curr + arr[i]);
            best = Math.max(best, curr);
        }
        return best;
    }
}`,
        python: `def maxSubarraySum(n: int, arr: List[int]) -> int:
    best = curr = arr[0]
    for x in arr[1:]:
        curr = max(x, curr + x)
        best = max(best, curr)
    return best`,
      },
      testCases: [
        {
          id: "tc-code1-1",
          input: "9\n-2 1 -3 4 -1 2 1 -5 4\n",
          expectedOutput: "6",
          isSample: true,
          points: 20,
          explanation: "The contiguous subarray [4, -1, 2, 1] has the largest sum 4 + (-1) + 2 + 1 = 6.",
        },
        {
          id: "tc-code1-2",
          input: "1\n5\n",
          expectedOutput: "5",
          isSample: true,
          points: 20,
          explanation: "With a single element [5], the maximum subarray sum is 5.",
        },
        {
          id: "tc-code1-3",
          input: "5\n-8 -3 -6 -2 -5\n",
          expectedOutput: "-2",
          isSample: false,
          points: 30,
        },
        {
          id: "tc-code1-4",
          input: "6\n10 -2 3 4 -1 2\n",
          expectedOutput: "16",
          isSample: false,
          points: 30,
        },
      ],
    }),
    makeCodingQuestion({
      id: "code-2",
      title: "Find Odd Occurrence Element",
      difficulty: "Medium",
      points: 150,
      description:
        "You are given an array `arr` of `n` integers where every number appears an even number of times except for exactly one element which appears an odd number of times.\n\nFind and return the element that occurs an odd number of times in O(n) time and O(1) extra space.",
      inputFormat:
        "The first line contains an odd integer `n`.\nThe second line contains `n` space-separated integers `arr`.",
      constraints: "1 <= n <= 10^5 (n is odd)\n-10^9 <= arr[i] <= 10^9",
      outputFormat: "Return the single integer appearing an odd number of times.",
      tags: ["Bit Manipulation", "XOR", "Arrays"],
      dslSource: `# Odd Occurrence Element DSL
function(integer, findOddOccurrence, integer n, integer_array arr)
integer(n)
Array(integer, arr, n, single)
INVOKE(integer, result, findOddOccurrence, n, arr)
print(integer, result)`,
      sampleSolutions: {
        c: `int findOddOccurrence(int n, int* arr) {
    int ans = 0;
    for (int i = 0; i < n; i++) {
        ans ^= arr[i];
    }
    return ans;
}`,
        cpp: `int findOddOccurrence(int n, vector<int> arr) {
    int ans = 0;
    for (int x : arr) ans ^= x;
    return ans;
}`,
        java: `class Result {
    public static int findOddOccurrence(int n, int[] arr) {
        int ans = 0;
        for (int x : arr) ans ^= x;
        return ans;
    }
}`,
        python: `def findOddOccurrence(n: int, arr: List[int]) -> int:
    ans = 0
    for x in arr:
        ans ^= x
    return ans`,
      },
      testCases: [
        {
          id: "tc-code2-1",
          input: "7\n1 2 3 2 3 1 3\n",
          expectedOutput: "3",
          isSample: true,
          points: 30,
          explanation: "1 appears 2 times, 2 appears 2 times, and 3 appears 3 times (odd).",
        },
        {
          id: "tc-code2-2",
          input: "5\n5 7 5 7 9\n",
          expectedOutput: "9",
          isSample: true,
          points: 30,
        },
        {
          id: "tc-code2-3",
          input: "9\n10 20 10 30 20 40 30 40 99\n",
          expectedOutput: "99",
          isSample: false,
          points: 45,
        },
        {
          id: "tc-code2-4",
          input: "1\n-42\n",
          expectedOutput: "-42",
          isSample: false,
          points: 45,
        },
      ],
    }),
    makeCodingQuestion({
      id: "code-3",
      title: "Multi-Query Palindrome Number",
      difficulty: "Easy",
      points: 100,
      description:
        "Given `t` independent test cases, each containing an integer `n`, determine whether `n` reads the same forward and backward without converting negative signs into palindromes (negative integers are never palindromes).\n\nNotice how the DSL `loop(t) ... endloop` wrapper calls your function once per test case automatically.",
      inputFormat:
        "The first line contains `t`, the number of queries.\nEach of the next `t` lines contains an integer `n`.",
      constraints: "1 <= t <= 1000\n-10^9 <= n <= 10^9",
      outputFormat: "Return a boolean (`true` or `false`) for each query.",
      tags: ["Math", "Multi-Testcase DSL"],
      dslSource: `# Multi-Testcase Palindrome Check DSL
function(boolean, isPalindrome, integer n)
loop(t)
    integer(n)
    INVOKE(boolean, result, isPalindrome, n)
    print(boolean, result)
endloop`,
      sampleSolutions: {
        c: `bool isPalindrome(int n) {
    if (n < 0) return false;
    long long orig = n, rev = 0;
    while (n > 0) {
        rev = rev * 10 + (n % 10);
        n /= 10;
    }
    return orig == rev;
}`,
        cpp: `bool isPalindrome(int n) {
    if (n < 0) return false;
    long long orig = n, rev = 0;
    while (n > 0) {
        rev = rev * 10 + (n % 10);
        n /= 10;
    }
    return orig == rev;
}`,
        java: `class Result {
    public static boolean isPalindrome(int n) {
        if (n < 0) return false;
        long orig = n, rev = 0;
        while (n > 0) {
            rev = rev * 10 + (n % 10);
            n /= 10;
        }
        return orig == rev;
    }
}`,
        python: `def isPalindrome(n: int) -> bool:
    if n < 0:
        return False
    s = str(n)
    return s == s[::-1]`,
      },
      testCases: [
        {
          id: "tc-code3-1",
          input: "3\n121\n-121\n10\n",
          expectedOutput: "true\nfalse\nfalse",
          isSample: true,
          points: 40,
        },
        {
          id: "tc-code3-2",
          input: "4\n0\n12321\n9999\n10010\n",
          expectedOutput: "true\ntrue\ntrue\nfalse",
          isSample: false,
          points: 60,
        },
      ],
    }),
    makeCodingQuestion({
      id: "code-4",
      title: "Matrix Diagonal Sum",
      difficulty: "Medium",
      points: 150,
      description:
        "Given an `n x m` square integer matrix (`n == m`), return the sum of all elements on the primary diagonal and secondary diagonal without double-counting the center intersection cell when `n` is odd.",
      inputFormat:
        "The first line contains two integers `n` and `m`.\nThe next `n` lines each contain `m` space-separated integers.",
      constraints: "1 <= n = m <= 200\n-10^4 <= mat[i][j] <= 10^4",
      outputFormat: "Return the integer sum of the diagonals.",
      tags: ["Matrix", "2DArray DSL"],
      dslSource: `# 2D Matrix Diagonal Sum DSL
function(integer, diagonalSum, integer n, integer m, 2d_integer_array mat)
integer(n) integer(m)
2DArray(integer, mat, n, m)
INVOKE(integer, result, diagonalSum, n, m, mat)
print(integer, result)`,
      sampleSolutions: {
        c: `int diagonalSum(int n, int m, int** mat) {
    int sum = 0;
    for (int i = 0; i < n; i++) {
        sum += mat[i][i];
        if (i != n - 1 - i) sum += mat[i][n - 1 - i];
    }
    return sum;
}`,
        cpp: `int diagonalSum(int n, int m, vector<vector<int>> mat) {
    int sum = 0;
    for (int i = 0; i < n; i++) {
        sum += mat[i][i];
        if (i != n - 1 - i) sum += mat[i][n - 1 - i];
    }
    return sum;
}`,
        java: `class Result {
    public static int diagonalSum(int n, int m, int[][] mat) {
        int sum = 0;
        for (int i = 0; i < n; i++) {
            sum += mat[i][i];
            if (i != n - 1 - i) sum += mat[i][n - 1 - i];
        }
        return sum;
    }
}`,
        python: `def diagonalSum(n: int, m: int, mat: List[List[int]]) -> int:
    total = 0
    for i in range(n):
        total += mat[i][i]
        if i != n - 1 - i:
            total += mat[i][n - 1 - i]
    return total`,
      },
      testCases: [
        {
          id: "tc-code4-1",
          input: "3 3\n1 2 3\n4 5 6\n7 8 9\n",
          expectedOutput: "25",
          isSample: true,
          points: 50,
        },
        {
          id: "tc-code4-2",
          input: "2 2\n1 1\n1 1\n",
          expectedOutput: "4",
          isSample: false,
          points: 50,
        },
        {
          id: "tc-code4-3",
          input: "4 4\n1 1 1 1\n1 1 1 1\n1 1 1 1\n1 1 1 1\n",
          expectedOutput: "8",
          isSample: false,
          points: 50,
        },
      ],
    }),
  ];

  const code1 = codingQuestions[0];
  const code2 = codingQuestions[1];

  const aaravCode1 = code1.sampleSolutions!.cpp!;
  const diyaCode1 = code1.sampleSolutions!.python!;

  return {
    users: [
      {
        id: "user-mod-1",
        name: "Samarth Pai",
        handle: "samarth_mod",
        email: "samarth@turecode.dev",
        role: "moderator",
      },
      {
        id: "user-p-1",
        name: "Aarav Sharma",
        handle: "aarav_s",
        email: "aarav@turecode.dev",
        role: "participant",
      },
      {
        id: "user-p-2",
        name: "Diya Nair",
        handle: "diya_codes",
        email: "diya@turecode.dev",
        role: "participant",
      },
      {
        id: "user-p-3",
        name: "Rohan Verma",
        handle: "rohan_v",
        email: "rohan@turecode.dev",
        role: "participant",
      },
      {
        id: "user-p-4",
        name: "Priya Patel",
        handle: "priya_p",
        email: "priya@turecode.dev",
        role: "participant",
      },
    ],
    questions: [...mcqQuestions, ...codingQuestions],
    contests: [
      {
        id: "contest-1",
        title: "AlgoSprint Championship 2026",
        slug: "algosprint-2026",
        joinCode: "ALGO-2026",
        strictMode: false,
        description:
          "Multi-stage competitive assessment featuring an objective CS & Linux Systems screening round followed by a DSL-driven C/C++/Java/Python algorithmic coding round executed inside the Rootless Landlock Sandbox.",
        organizerId: "user-mod-1",
        organizerName: "Samarth Pai",
        createdAt: h(-24),
        rounds: [
          {
            id: "round-1",
            contestId: "contest-1",
            title: "Round 1: Core CS & Systems Screening",
            description: "Multiple-choice screening covering algorithms, complexity, Linux Landlock LSM, and POSIX fork-server architecture.",
            type: "mcq",
            order: 1,
            startTime: h(-2),
            endTime: h(24),
            durationMinutes: 30,
            questionIds: ["mcq-1", "mcq-2", "mcq-3", "mcq-4"],
          },
          {
            id: "round-2",
            contestId: "contest-1",
            title: "Round 2: Algorithmic Coding Finals",
            description: "Solve DSL-stubbed coding challenges in C, C++, Java, or Python. Submissions are graded concurrently in isolated Landlock sandboxes.",
            type: "coding",
            order: 2,
            startTime: h(-1),
            endTime: h(48),
            durationMinutes: 90,
            questionIds: ["code-1", "code-2", "code-3"],
          },
        ],
      },
      {
        id: "contest-2",
        title: "Weekend CodeBlitz #14",
        slug: "weekend-codeblitz-14",
        joinCode: "BLITZ-14",
        strictMode: true,
        description:
          "Fast-paced weekend challenge combining an MCQ warmup round and an upcoming matrix & array coding sprint.",
        organizerId: "user-mod-1",
        organizerName: "Samarth Pai",
        createdAt: h(-12),
        rounds: [
          {
            id: "round-201",
            contestId: "contest-2",
            title: "Round 1: Data Structures Warmup",
            description: "Quick conceptual MCQ round on trees and systems IPC.",
            type: "mcq",
            order: 1,
            startTime: h(-1),
            endTime: h(12),
            durationMinutes: 20,
            questionIds: ["mcq-5", "mcq-6"],
          },
          {
            id: "round-202",
            contestId: "contest-2",
            title: "Round 2: Matrix & Array Sprint",
            description: "Scheduled upcoming coding round powered by HackerRank DSL stubs.",
            type: "coding",
            order: 2,
            startTime: h(2),
            endTime: h(26),
            durationMinutes: 60,
            questionIds: ["code-4", "code-1"],
          },
        ],
      },
    ],
    contestEnrollments: [
      { contestId: "contest-1", userId: "user-p-1", joinedAt: h(-2) },
      { contestId: "contest-1", userId: "user-p-2", joinedAt: h(-2) },
      { contestId: "contest-1", userId: "user-p-3", joinedAt: h(-2) },
      { contestId: "contest-2", userId: "user-p-1", joinedAt: h(-1) },
    ],
    mcqSubmissions: [
      {
        id: "sub-mcq-1",
        contestId: "contest-1",
        roundId: "round-1",
        questionId: "mcq-1",
        userId: "user-p-1",
        selectedOptionId: "b",
        isCorrect: true,
        score: 25,
        submittedAt: h(-1.5),
      },
      {
        id: "sub-mcq-2",
        contestId: "contest-1",
        roundId: "round-1",
        questionId: "mcq-2",
        userId: "user-p-1",
        selectedOptionId: "b",
        isCorrect: true,
        score: 25,
        submittedAt: h(-1.5),
      },
      {
        id: "sub-mcq-3",
        contestId: "contest-1",
        roundId: "round-1",
        questionId: "mcq-3",
        userId: "user-p-1",
        selectedOptionId: "c",
        isCorrect: true,
        score: 25,
        submittedAt: h(-1.5),
      },
      {
        id: "sub-mcq-4",
        contestId: "contest-1",
        roundId: "round-1",
        questionId: "mcq-4",
        userId: "user-p-1",
        selectedOptionId: "b",
        isCorrect: true,
        score: 25,
        submittedAt: h(-1.5),
      },
      {
        id: "sub-mcq-5",
        contestId: "contest-1",
        roundId: "round-1",
        questionId: "mcq-1",
        userId: "user-p-2",
        selectedOptionId: "b",
        isCorrect: true,
        score: 25,
        submittedAt: h(-1.2),
      },
      {
        id: "sub-mcq-6",
        contestId: "contest-1",
        roundId: "round-1",
        questionId: "mcq-2",
        userId: "user-p-2",
        selectedOptionId: "b",
        isCorrect: true,
        score: 25,
        submittedAt: h(-1.2),
      },
      {
        id: "sub-mcq-7",
        contestId: "contest-1",
        roundId: "round-1",
        questionId: "mcq-3",
        userId: "user-p-2",
        selectedOptionId: "a",
        isCorrect: false,
        score: -5,
        submittedAt: h(-1.2),
      },
      {
        id: "sub-mcq-8",
        contestId: "contest-1",
        roundId: "round-1",
        questionId: "mcq-4",
        userId: "user-p-2",
        selectedOptionId: "b",
        isCorrect: true,
        score: 25,
        submittedAt: h(-1.2),
      },
      {
        id: "sub-mcq-9",
        contestId: "contest-1",
        roundId: "round-1",
        questionId: "mcq-1",
        userId: "user-p-3",
        selectedOptionId: "b",
        isCorrect: true,
        score: 25,
        submittedAt: h(-1.0),
      },
      {
        id: "sub-mcq-10",
        contestId: "contest-1",
        roundId: "round-1",
        questionId: "mcq-2",
        userId: "user-p-3",
        selectedOptionId: "a",
        isCorrect: false,
        score: -5,
        submittedAt: h(-1.0),
      },
    ],
    codingSubmissions: [
      {
        id: "sub-code-1",
        contestId: "contest-1",
        roundId: "round-2",
        questionId: "code-1",
        userId: "user-p-1",
        language: "cpp",
        sourceCode: aaravCode1,
        fullSourceCode: stitchCodeStub(code1.codeStubs.cpp, aaravCode1),
        status: "Accepted",
        score: 100,
        maxScore: 100,
        passedCount: 4,
        totalCount: 4,
        executionTimeMs: 4.12,
        runId: "seed-run-aarav-1",
        testCaseResults: code1.testCases.map((tc) => ({
          testCaseId: tc.id,
          isSample: tc.isSample,
          passed: true,
          status: "Passed",
          executionTimeMs: 1.03,
        })),
        submittedAt: h(-0.8),
      },
      {
        id: "sub-code-2",
        contestId: "contest-1",
        roundId: "round-2",
        questionId: "code-2",
        userId: "user-p-1",
        language: "cpp",
        sourceCode: code2.sampleSolutions!.cpp!,
        fullSourceCode: stitchCodeStub(code2.codeStubs.cpp, code2.sampleSolutions!.cpp!),
        status: "Accepted",
        score: 150,
        maxScore: 150,
        passedCount: 4,
        totalCount: 4,
        executionTimeMs: 3.85,
        runId: "seed-run-aarav-2",
        testCaseResults: code2.testCases.map((tc) => ({
          testCaseId: tc.id,
          isSample: tc.isSample,
          passed: true,
          status: "Passed",
          executionTimeMs: 0.96,
        })),
        submittedAt: h(-0.6),
      },
      {
        id: "sub-code-3",
        contestId: "contest-1",
        roundId: "round-2",
        questionId: "code-1",
        userId: "user-p-2",
        language: "python",
        sourceCode: diyaCode1,
        fullSourceCode: stitchCodeStub(code1.codeStubs.python, diyaCode1),
        status: "Accepted",
        score: 100,
        maxScore: 100,
        passedCount: 4,
        totalCount: 4,
        executionTimeMs: 48.2,
        runId: "seed-run-diya-1",
        testCaseResults: code1.testCases.map((tc) => ({
          testCaseId: tc.id,
          isSample: tc.isSample,
          passed: true,
          status: "Passed",
          executionTimeMs: 12.05,
        })),
        submittedAt: h(-0.5),
      },
    ],
  };
}
