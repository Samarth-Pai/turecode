"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";

interface HealthData {
  status: string;
  daemon_socket: string;
  socket_active: boolean;
  daemon_binary_exists: boolean;
  workspaces_root: string;
  engine: string;
  supported_languages: string[];
  security: {
    rootless: boolean;
    filesystem_isolation: string;
    privilege_escalation: string;
    cpu_limit: string;
    ram_limit: string;
  };
}

interface BenchmarkData {
  concurrency: number;
  totalWallMs: number;
  throughputRps: number;
  successCount: number;
  errorCount: number;
  results: {
    language: string;
    ok: boolean;
    executionTimeMs: number;
    output: string;
    error: string | null;
  }[];
}

export default function SandboxStatusPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [concurrency, setConcurrency] = useState(12);
  const [running, setRunning] = useState(false);
  const [bench, setBench] = useState<BenchmarkData | null>(null);

  const loadHealth = useCallback(async () => {
    const res = await fetch("/api/sandbox/health", { cache: "no-store" });
    if (res.ok) setHealth(await res.json());
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/sandbox/health", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (active && json) setHealth(json);
      });
    return () => {
      active = false;
    };
  }, []);

  const runBenchmark = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/sandbox/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concurrency }),
      });
      if (res.ok) setBench(await res.json());
      await loadHealth();
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 space-y-6 font-spectral text-[#F5E6D3]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-cinzel text-xs uppercase tracking-[1px] text-[#BFA98A]">
            <Link href="/moderator" className="hover:text-[#F5E6D3] transition-colors">
              Moderator Studio
            </Link>
            <span className="text-[#5C3D2E]">/</span>
            <span className="text-[#CA8A04]">Sandbox Health</span>
          </div>
          <h1 className="font-cinzel text-2xl font-bold text-[#F5E6D3] mt-0.5">
            Rootless Code Sandbox Health & Benchmark
          </h1>
        </div>

        <button
          type="button"
          onClick={loadHealth}
          className="rounded-[4px] border border-[#5C3D2E] bg-[#3D2517] px-4 py-2 font-cinzel text-xs font-semibold uppercase tracking-[0.5px] text-[#F5E6D3] hover:border-[#CA8A04] transition-colors duration-300 cursor-pointer"
        >
          Refresh Status
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[4px] border border-[#5C3D2E] border-t-2 border-t-[#CA8A04] bg-[#2C1A10] p-5 space-y-3 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between">
            <h2 className="font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#BFA98A]">
              Fork-Server Daemon
            </h2>
            <span
              className={`rounded-[2px] border px-2.5 py-0.5 font-fira text-[11px] font-bold ${
                health?.socket_active
                  ? "border-[#22C55E]/40 bg-[#22C55E]/15 text-[#22C55E]"
                  : "border-[#B91C1C]/60 bg-[#991B1B]/25 text-[#F87171]"
              }`}
            >
              {health?.socket_active ? "ACTIVE" : "OFFLINE"}
            </span>
          </div>

          <dl className="space-y-2 text-xs">
            <div className="flex justify-between gap-2 border-b border-[#5C3D2E] pb-1.5">
              <dt className="text-[#BFA98A]">Unix Domain Socket</dt>
              <dd className="font-fira text-[#CA8A04]">{health?.daemon_socket ?? "..."}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-[#5C3D2E] pb-1.5">
              <dt className="text-[#BFA98A]">Workspaces Root</dt>
              <dd className="font-fira text-[#F5E6D3]">{health?.workspaces_root ?? "..."}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-[#5C3D2E] pb-1.5">
              <dt className="text-[#BFA98A]">Languages</dt>
              <dd className="font-fira text-[#22C55E]">
                {health?.supported_languages.join(", ").toUpperCase() ?? "C, CPP, JAVA, PYTHON"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[#BFA98A]">Engine</dt>
              <dd className="text-right text-[#F5E6D3]">{health?.engine ?? "..."}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-[4px] border border-[#5C3D2E] border-t-2 border-t-[#CA8A04] bg-[#2C1A10] p-5 space-y-3 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
          <h2 className="font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#BFA98A]">
            Kernel Isolation & Resource Bounds
          </h2>
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between gap-3 border-b border-[#5C3D2E] pb-1.5">
              <dt className="text-[#BFA98A]">Filesystem Jail</dt>
              <dd className="text-right text-[#22C55E]">
                {health?.security.filesystem_isolation ?? "..."}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-[#5C3D2E] pb-1.5">
              <dt className="text-[#BFA98A]">Privilege Escalation</dt>
              <dd className="text-right font-fira text-[#CA8A04]">
                {health?.security.privilege_escalation ?? "..."}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-[#5C3D2E] pb-1.5">
              <dt className="text-[#BFA98A]">CPU Limit</dt>
              <dd className="text-right font-fira text-[#F5E6D3]">
                {health?.security.cpu_limit ?? "..."}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#BFA98A]">Memory Limit</dt>
              <dd className="text-right font-fira text-[#F5E6D3]">
                {health?.security.ram_limit ?? "..."}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="rounded-[4px] border border-[#5C3D2E] bg-[#2C1A10] p-6 space-y-4 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-cinzel text-base font-bold text-[#F5E6D3]">
              Concurrent Multi-Language Stress Test
            </h2>
            <p className="font-spectral text-xs text-[#BFA98A] mt-0.5">
              Executes parallel compilations and sandboxed runs across C, C++, Java, and Python.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              className="rounded-[4px] border border-[#5C3D2E] bg-[#1A0F0A] px-3 py-1.5 font-fira text-xs text-[#F5E6D3]"
            >
              <option value={8}>8 jobs</option>
              <option value={12}>12 jobs</option>
              <option value={20}>20 jobs</option>
            </select>

            <button
              type="button"
              onClick={runBenchmark}
              disabled={running}
              className="rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-4 py-2 font-cinzel text-xs font-bold uppercase tracking-[0.5px] text-[#1A0F0A] hover:bg-[#B8780A] disabled:opacity-50 transition-colors duration-300 cursor-pointer"
            >
              {running ? "Running Burst..." : "Run Concurrent Test"}
            </button>
          </div>
        </div>

        {bench && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-[4px] border border-[#5C3D2E] bg-[#1A0F0A] p-3">
                <div className="font-cinzel text-[10px] uppercase tracking-[1px] text-[#BFA98A]">
                  Success Rate
                </div>
                <div className="font-fira text-lg font-bold text-[#22C55E] mt-0.5">
                  {bench.successCount} / {bench.concurrency}
                </div>
              </div>
              <div className="rounded-[4px] border border-[#5C3D2E] bg-[#1A0F0A] p-3">
                <div className="font-cinzel text-[10px] uppercase tracking-[1px] text-[#BFA98A]">
                  Wall Time
                </div>
                <div className="font-fira text-lg font-bold text-[#F5E6D3] mt-0.5">
                  {bench.totalWallMs} ms
                </div>
              </div>
              <div className="rounded-[4px] border border-[#5C3D2E] bg-[#1A0F0A] p-3">
                <div className="font-cinzel text-[10px] uppercase tracking-[1px] text-[#BFA98A]">
                  Throughput
                </div>
                <div className="font-fira text-lg font-bold text-[#CA8A04] mt-0.5">
                  {bench.throughputRps} jobs/sec
                </div>
              </div>
              <div className="rounded-[4px] border border-[#5C3D2E] bg-[#1A0F0A] p-3">
                <div className="font-cinzel text-[10px] uppercase tracking-[1px] text-[#BFA98A]">
                  Errors
                </div>
                <div className="font-fira text-lg font-bold text-[#F5E6D3] mt-0.5">
                  {bench.errorCount}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
