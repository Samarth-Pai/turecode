"use client";

import { AlertTriangle, Lock, Maximize2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface StrictModeGuardProps {
  contestId: string;
  contestTitle: string;
  hasOngoingRound: boolean;
  ongoingRoundTitles?: string[];
  isModerator: boolean;
  isEnrolled: boolean;
  userId?: string;
  children: React.ReactNode;
}

const MAX_VIOLATIONS = 7;

async function engageEscapeKeyLock(): Promise<void> {
  if (typeof navigator === "undefined") return;
  const navWithKeyboard = navigator as Navigator & {
    keyboard?: { lock?: (keys?: string[]) => Promise<void> };
  };
  try {
    await navWithKeyboard.keyboard?.lock?.(["Escape"]);
  } catch {
    // Browser may not support Keyboard Lock API
  }
}

export function StrictModeGuard({
  contestId,
  contestTitle,
  hasOngoingRound,
  ongoingRoundTitles = [],
  isModerator,
  isEnrolled,
  userId,
  children,
}: StrictModeGuardProps) {
  const active = hasOngoingRound && isEnrolled && !isModerator && Boolean(userId);
  const storageKey = userId
    ? `turecode_proctor_active_${contestId}_${userId}`
    : "";

  const [isFullscreen, setIsFullscreen] = useState<boolean>(() =>
    typeof document !== "undefined" ? Boolean(document.fullscreenElement) : false
  );
  const [started, setStarted] = useState<boolean>(() => {
    if (typeof window === "undefined" || !storageKey) return false;
    return window.localStorage.getItem(storageKey) === "1";
  });
  const [violations, setViolations] = useState(0);
  const [warningModal, setWarningModal] = useState<{
    count: number;
    reason: string;
  } | null>(null);
  const [fsError, setFsError] = useState<string | null>(null);

  const lastViolationTs = useRef(0);
  const startedRef = useRef(started);
  const activeRef = useRef(active);
  const prevActiveRef = useRef(false);

  useEffect(() => {
    startedRef.current = started;
  }, [started]);

  // Load current violation count from DB whenever active/contest/user changes
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
      if (!activeRef.current || !startedRef.current) return;
      const now = Date.now();
      if (now - lastViolationTs.current < 900) return;
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
          if (!data.ignored && typeof data.count === "number") {
            setViolations(data.count);
            setWarningModal({ count: data.count, reason });
          }
        }
      } catch {
        // ignore network error
      }
    },
    [contestId, userId]
  );

  // Sync fullscreen & started state whenever `active` transitions (e.g. Round 2 starts after a break)
  useEffect(() => {
    const wasActive = prevActiveRef.current;
    prevActiveRef.current = active;
    activeRef.current = active;

    if (!active) {
      if (typeof window !== "undefined" && storageKey) {
        window.localStorage.removeItem(storageKey);
      }
      startedRef.current = false;
      if (wasActive) {
        const t = setTimeout(() => {
          setStarted(false);
          setWarningModal(null);
          setFsError(null);
        }, 0);
        return () => clearTimeout(t);
      }
      return;
    }

    // `active` is true (either initial mount with ongoing round, or Round 2+ just started)
    const currentlyFs = Boolean(document.fullscreenElement);
    const wasStarted =
      typeof window !== "undefined" &&
      Boolean(storageKey) &&
      window.localStorage.getItem(storageKey) === "1";

    const t = setTimeout(() => {
      setIsFullscreen(currentlyFs);

      if (currentlyFs) {
        if (typeof window !== "undefined" && storageKey) {
          window.localStorage.setItem(storageKey, "1");
        }
        startedRef.current = true;
        setStarted(true);
        void engageEscapeKeyLock();
      } else if (wasStarted) {
        startedRef.current = true;
        setStarted(true);
        void recordViolation(
          "Exited fullscreen or reloaded page while a round is ongoing"
        );
      } else {
        startedRef.current = false;
        setStarted(false);
      }
    }, 0);

    return () => clearTimeout(t);
  }, [active, storageKey, recordViolation]);

  // Always keep `isFullscreen` synced with browser fullscreen state even before a round starts
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fs = Boolean(document.fullscreenElement);
      setIsFullscreen(fs);
      if (fs) {
        if (activeRef.current) {
          void engageEscapeKeyLock();
        }
      } else if (startedRef.current && activeRef.current) {
        void recordViolation("Exited fullscreen mode while a round is ongoing");
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [recordViolation]);

  useEffect(() => {
    if (!active) return;

    const handleVisibility = () => {
      if (document.hidden && startedRef.current && activeRef.current) {
        void recordViolation(
          "Switched browser tab or minimized window while a round is ongoing"
        );
      }
    };

    const handleBlur = () => {
      if (startedRef.current && activeRef.current) {
        void recordViolation(
          "Left the contest window / switched focus while a round is ongoing"
        );
      }
    };

    // Block accidental Escape / F11 key presses from exiting fullscreen
    const handleKeyCapture = (e: KeyboardEvent) => {
      if (!activeRef.current) return;
      if (e.key === "Escape" || e.key === "Esc" || e.key === "F11") {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") {
          e.stopImmediatePropagation();
        }
        if (document.fullscreenElement) {
          void engageEscapeKeyLock();
        }
      }
    };

    const handlePointerDown = () => {
      if (activeRef.current && document.fullscreenElement) {
        void engageEscapeKeyLock();
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!activeRef.current || !startedRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("keydown", handleKeyCapture, true);
    window.addEventListener("keyup", handleKeyCapture, true);
    document.addEventListener("keydown", handleKeyCapture, true);
    document.addEventListener("keyup", handleKeyCapture, true);
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("keydown", handleKeyCapture, true);
      window.removeEventListener("keyup", handleKeyCapture, true);
      document.removeEventListener("keydown", handleKeyCapture, true);
      document.removeEventListener("keyup", handleKeyCapture, true);
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [active, recordViolation]);

  const enterFullscreen = async () => {
    setFsError(null);
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      await engageEscapeKeyLock();
    } catch {
      // handled below via document.fullscreenElement check
    }

    const actuallyFs = Boolean(document.fullscreenElement);
    setIsFullscreen(actuallyFs);

    if (!actuallyFs) {
      setFsError(
        "Fullscreen permission was blocked by your browser. Please allow Fullscreen to continue the ongoing contest."
      );
      return;
    }

    if (typeof window !== "undefined" && storageKey) {
      window.localStorage.setItem(storageKey, "1");
    }
    startedRef.current = true;
    setStarted(true);
    setWarningModal(null);
  };

  if (!active) {
    return <>{children}</>;
  }

  const isSessionLocked = violations > MAX_VIOLATIONS;
  const requiresFullscreenGate = !started || !isFullscreen;
  const isBlocked = isSessionLocked || requiresFullscreenGate || Boolean(warningModal);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Status Banner */}
      <div className="border-b border-[#462E22] bg-[#2A1810] px-4 py-1.5 flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-2 font-spectral text-[#F5E6D3]">
          <ShieldAlert className="h-3.5 w-3.5 text-[#CA8A04]" />
          Proctoring Active (Round Ongoing) — Stay in Fullscreen &amp; Do Not Switch Tabs
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

      {/* Keep children ALWAYS mounted so code editor drafts and MCQ selections are never reset on violation */}
      <div
        className={`flex min-h-0 flex-1 flex-col ${
          isBlocked ? "invisible pointer-events-none select-none" : ""
        }`}
        aria-hidden={isBlocked}
      >
        {children}
      </div>

      {/* Session Locked Overlay (> 7 violations) */}
      {isSessionLocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#110A07]/95 p-6 backdrop-blur-md">
          <div className="max-w-md w-full rounded-[6px] border border-[#B91C1C] border-t-2 border-t-[#991B1B] bg-[#1D110B] p-8 text-center space-y-4 shadow-[0_8px_32px_rgba(202,138,4,0.25)]">
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
              while a round is ongoing in{" "}
              <strong className="text-[#F5E6D3]">{contestTitle}</strong>. Your
              code and MCQ progress are saved—ask a moderator to reset your
              penalty limit to resume.
            </p>
            <Link
              href="/"
              className="inline-block rounded-[4px] border border-[#CA8A04] bg-transparent px-5 py-2.5 font-cinzel text-xs font-semibold uppercase tracking-[1px] text-[#CA8A04] hover:bg-[#CA8A04]/10"
            >
              Return to Contest Hub
            </Link>
          </div>
        </div>
      )}

      {/* Fullscreen Required / Violation Gate Overlay */}
      {!isSessionLocked && (requiresFullscreenGate || warningModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#110A07]/95 p-6 backdrop-blur-md">
          <div className="max-w-lg w-full rounded-[6px] border border-[#462E22] border-t-2 border-t-[#CA8A04] bg-[#1D110B] p-8 space-y-5 shadow-[0_8px_32px_rgba(202,138,4,0.25)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[4px] border border-[#581C87] bg-[#581C87]/35 text-[#E9D5FF]">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <span className="font-cinzel text-[11px] font-semibold uppercase tracking-[1px] text-[#CA8A04]">
                  Live Round Ongoing — Fullscreen Required
                </span>
                <h1 className="font-cinzel text-xl font-bold text-[#F5E6D3]">
                  {contestTitle}
                </h1>
              </div>
            </div>

            {warningModal && (
              <div className="rounded-[4px] border border-[#B91C1C] bg-[#991B1B]/25 p-3.5 space-y-1">
                <div className="flex items-center gap-2 font-cinzel text-xs font-bold uppercase text-[#F87171]">
                  <AlertTriangle className="h-4 w-4 text-[#CA8A04]" />
                  Proctoring Warning ({warningModal.count} / {MAX_VIOLATIONS})
                </div>
                <p className="font-spectral text-xs text-[#F5E6D3]">
                  Reason: <strong className="text-[#CA8A04]">{warningModal.reason}</strong>.{" "}
                  {warningModal.count >= MAX_VIOLATIONS
                    ? "Final warning (7/7)! One more violation will lock your contest session."
                    : `${MAX_VIOLATIONS - warningModal.count} warning(s) remaining before lock.`}
                </p>
                <p className="font-spectral text-[11px] text-[#22C55E]">
                  Your code and attempted MCQ options are preserved.
                </p>
              </div>
            )}

            <div className="rounded-[4px] border border-[#462E22] bg-[#110A07] p-4 space-y-2 font-spectral text-sm text-[#BFA98A]">
              {ongoingRoundTitles.length > 0 && (
                <p className="text-xs text-[#CA8A04] font-semibold">
                  Ongoing Round{ongoingRoundTitles.length > 1 ? "s" : ""}:{" "}
                  {ongoingRoundTitles.join(", ")}
                </p>
              )}
              <p>
                • You must remain in <strong className="text-[#F5E6D3]">Fullscreen Mode</strong>{" "}
                across the entire contest while any round is ongoing.
              </p>
              <p>
                • Exiting fullscreen, switching tabs, minimizing, or leaving the window counts as a violation.
              </p>
              <p>
                • Violations are <strong className="text-[#22C55E]">never counted</strong> when no rounds are ongoing.
              </p>
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

            {fsError && (
              <div className="rounded-[4px] border border-[#B91C1C] bg-[#991B1B]/20 px-3 py-2 font-spectral text-xs text-[#FCA5A5]">
                {fsError}
              </div>
            )}

            <button
              type="button"
              onClick={enterFullscreen}
              className="w-full inline-flex items-center justify-center gap-2 rounded-[4px] border border-[#DAA520] bg-[#CA8A04] py-3 font-cinzel text-xs font-bold uppercase tracking-[1px] text-[#110A07] shadow-[0_2px_8px_rgba(202,138,4,0.25)] hover:bg-[#B8780A] transition-all duration-300 cursor-pointer"
            >
              <Maximize2 className="h-4 w-4" />
              {started || warningModal
                ? "Acknowledge & Return to Fullscreen"
                : "Enter Fullscreen & Continue to Contest"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
