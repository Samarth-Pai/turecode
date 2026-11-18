"use client";

import { AlertTriangle, Lock, Maximize2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface StrictModeGuardProps {
  contestId: string;
  contestTitle: string;
  enabled: boolean;
  isModerator: boolean;
  userId?: string;
  children: React.ReactNode;
}

const MAX_VIOLATIONS = 7;

export function StrictModeGuard({
  contestId,
  contestTitle,
  enabled,
  isModerator,
  userId,
  children,
}: StrictModeGuardProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [started, setStarted] = useState(false);
  const [violations, setViolations] = useState(0);
  const [warningModal, setWarningModal] = useState<{
    count: number;
    reason: string;
  } | null>(null);
  const lastViolationTs = useRef(0);
  const startedRef = useRef(false);

  const active = enabled && !isModerator;

  useEffect(() => {
    startedRef.current = started;
  }, [started]);

  useEffect(() => {
    if (!active || !userId) return;
    let mounted = true;
    fetch(
      `/api/contests/${contestId}/violations?userId=${encodeURIComponent(userId)}`,
      { cache: "no-store" }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!mounted || !data?.violations?.[0]) return;
        setViolations(data.violations[0].count || 0);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [active, contestId, userId]);

  const recordViolation = useCallback(
    async (reason: string) => {
      if (!active || !startedRef.current) return;
      const now = Date.now();
      if (now - lastViolationTs.current < 800) return;
      lastViolationTs.current = now;

      setViolations((prev) => {
        const optimistic = prev + 1;
        setWarningModal({ count: optimistic, reason });
        return optimistic;
      });

      try {
        const res = await fetch(`/api/contests/${contestId}/violations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, reason }),
        });
        if (res.ok) {
          const data = await res.json();
          setViolations(data.count);
          setWarningModal({ count: data.count, reason });
        }
      } catch {
        // ignore network error
      }
    },
    [active, contestId, userId]
  );

  useEffect(() => {
    if (!active) return;

    const handleFullscreenChange = () => {
      const fs = Boolean(document.fullscreenElement);
      setIsFullscreen(fs);
      if (!fs && startedRef.current) {
        recordViolation("Exited fullscreen mode");
      }
    };

    const handleVisibility = () => {
      if (document.hidden && startedRef.current) {
        recordViolation("Switched browser tab or minimized window");
      }
    };

    const handleBlur = () => {
      if (startedRef.current) {
        recordViolation("Left the contest window / switched focus");
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
    };
  }, [active, recordViolation]);

  const enterFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      setIsFullscreen(true);
      setStarted(true);
      setWarningModal(null);
    } catch {
      setIsFullscreen(true);
      setStarted(true);
      setWarningModal(null);
    }
  };

  if (!active) {
    return <>{children}</>;
  }

  if (violations > MAX_VIOLATIONS) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-[6px] border border-[#B91C1C] border-t-2 border-t-[#991B1B] bg-[#2C1A10] p-8 text-center space-y-4 shadow-[0_8px_32px_rgba(202,138,4,0.25)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[4px] border border-[#B91C1C] bg-[#991B1B]/25 text-[#F87171]">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="font-cinzel text-xl font-bold text-[#F5E6D3]">
            Contest Session Locked
          </h1>
          <p className="font-spectral text-sm text-[#BFA98A] leading-relaxed">
            You exceeded the maximum allowed{" "}
            <strong className="text-[#F87171]">
              {MAX_VIOLATIONS} proctoring violations
            </strong>{" "}
            in Strict Mode for <strong className="text-[#F5E6D3]">{contestTitle}</strong>.
          </p>
          <Link
            href={`/contests/${contestId}`}
            className="inline-block rounded-[4px] border border-[#CA8A04] bg-transparent px-5 py-2.5 font-cinzel text-xs font-semibold uppercase tracking-[1px] text-[#CA8A04] hover:bg-[#CA8A04]/10"
          >
            Return to Contest Lobby
          </Link>
        </div>
      </div>
    );
  }

  if (!started || !isFullscreen) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-[6px] border border-[#5C3D2E] border-t-2 border-t-[#CA8A04] bg-[#2C1A10] p-8 space-y-5 shadow-[0_8px_32px_rgba(202,138,4,0.25)]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[4px] border border-[#581C87] bg-[#581C87]/35 text-[#E9D5FF]">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <span className="font-cinzel text-[11px] font-semibold uppercase tracking-[1px] text-[#CA8A04]">
                Strict Proctoring Enabled
              </span>
              <h1 className="font-cinzel text-xl font-bold text-[#F5E6D3]">
                {contestTitle}
              </h1>
            </div>
          </div>

          <div className="rounded-[4px] border border-[#5C3D2E] bg-[#1A0F0A] p-4 space-y-2 font-spectral text-sm text-[#BFA98A]">
            <p>• You must remain in <strong className="text-[#F5E6D3]">Fullscreen Mode</strong> for the entire round.</p>
            <p>• Switching browser tabs, minimizing, or leaving the window triggers a violation warning.</p>
            <p>
              • Maximum <strong className="text-[#CA8A04]">{MAX_VIOLATIONS} violations</strong>{" "}
              are allowed before the session locks.
            </p>
            {violations > 0 && (
              <p className="text-[#CA8A04] font-semibold pt-1">
                Current recorded violations: {violations} / {MAX_VIOLATIONS}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={enterFullscreen}
            className="w-full inline-flex items-center justify-center gap-2 rounded-[4px] border border-[#DAA520] bg-[#CA8A04] py-3 font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#1A0F0A] shadow-[0_2px_8px_rgba(202,138,4,0.25)] hover:bg-[#B8780A] transition-all duration-300 cursor-pointer"
          >
            <Maximize2 className="h-4 w-4" />
            {started ? "Return to Fullscreen & Continue" : "Enter Fullscreen & Start Round"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-[#5C3D2E] bg-[#3D2517] px-4 py-1.5 flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-2 font-spectral text-[#F5E6D3]">
          <ShieldAlert className="h-3.5 w-3.5 text-[#CA8A04]" />
          Strict Proctoring Active — Stay in Fullscreen & Do Not Switch Tabs
        </span>
        <span
          className={`font-fira font-bold px-2.5 py-0.5 rounded-[2px] ${
            violations === 0
              ? "bg-[#22C55E]/20 text-[#22C55E]"
              : violations < MAX_VIOLATIONS
              ? "bg-[#CA8A04]/20 text-[#CA8A04]"
              : "bg-[#991B1B]/30 text-[#F87171]"
          }`}
        >
          Violations: {violations} / {MAX_VIOLATIONS}
        </span>
      </div>

      {children}

      {warningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A0F0A]/85 p-4">
          <div className="max-w-md w-full rounded-[6px] border border-[#CA8A04] border-t-2 border-t-[#991B1B] bg-[#2C1A10] p-6 text-center space-y-4 shadow-[0_8px_32px_rgba(202,138,4,0.3)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[4px] border border-[#CA8A04] bg-[#CA8A04]/20 text-[#CA8A04]">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="font-cinzel text-lg font-bold text-[#F5E6D3]">
              Proctoring Warning ({warningModal.count} / {MAX_VIOLATIONS})
            </h2>
            <p className="font-spectral text-sm text-[#BFA98A] leading-relaxed">
              Detected: <strong className="text-[#CA8A04]">{warningModal.reason}</strong>.
              <br />
              {warningModal.count >= MAX_VIOLATIONS
                ? "This is your final warning (7/7). One more violation will lock your contest session."
                : `You have ${MAX_VIOLATIONS - warningModal.count} warning(s) remaining before your session is locked.`}
            </p>
            <button
              type="button"
              onClick={enterFullscreen}
              className="w-full rounded-[4px] border border-[#DAA520] bg-[#CA8A04] py-2.5 font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#1A0F0A] hover:bg-[#B8780A] cursor-pointer"
            >
              Acknowledge & Return to Fullscreen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
