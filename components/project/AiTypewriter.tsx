"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export interface AiTypewriterRenderState {
  segments: string[];
  isComplete: boolean;
  skip: () => void;
}

interface AiTypewriterProps {
  segments: readonly string[];
  enabled: boolean;
  resetKey: string | number;
  children: (state: AiTypewriterRenderState) => ReactNode;
  charactersPerSecond?: number;
  completionMessage?: string;
}

interface AnimationState {
  runKey: string;
  revealed: number;
  isComplete: boolean;
}

export function AiTypewriter({
  segments,
  enabled,
  resetKey,
  children,
  charactersPerSecond = 48,
  completionMessage = "결과 생성이 완료되었습니다.",
}: AiTypewriterProps) {
  const serializedSegments = JSON.stringify(segments);
  const characters = useMemo(
    () => (JSON.parse(serializedSegments) as unknown[]).map((segment) =>
      Array.from(typeof segment === "string" ? segment : "")
    ),
    [serializedSegments],
  );
  const runKey = `${resetKey}\0${serializedSegments}`;
  const totalCharacters = characters.reduce((total, segment) => total + segment.length, 0);
  const frameRef = useRef<number | null>(null);
  const skippedRunRef = useRef("");
  const [animation, setAnimation] = useState<AnimationState>({
    runKey: "",
    revealed: 0,
    isComplete: false,
  });

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const skip = useCallback(() => {
    skippedRunRef.current = runKey;
    cancelFrame();
    setAnimation({ runKey, revealed: totalCharacters, isComplete: true });
  }, [cancelFrame, runKey, totalCharacters]);

  useEffect(() => {
    cancelFrame();
    if (!enabled || skippedRunRef.current === runKey) return;

    const revealImmediately =
      totalCharacters === 0 ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let startedAt: number | undefined;

    const reveal = (now: number) => {
      if (revealImmediately) {
        setAnimation({ runKey, revealed: totalCharacters, isComplete: true });
        frameRef.current = null;
        return;
      }

      startedAt ??= now;
      const revealed = Math.min(
        totalCharacters,
        Math.floor(((now - startedAt) * Math.max(1, charactersPerSecond)) / 1000),
      );
      const isComplete = revealed === totalCharacters;
      setAnimation({ runKey, revealed, isComplete });
      frameRef.current = isComplete ? null : requestAnimationFrame(reveal);
    };

    frameRef.current = requestAnimationFrame(reveal);
    return cancelFrame;
  }, [cancelFrame, charactersPerSecond, enabled, runKey, totalCharacters]);

  const current = !enabled
    ? { runKey, revealed: totalCharacters, isComplete: true }
    : animation.runKey === runKey
      ? animation
      : { runKey, revealed: 0, isComplete: false };
  let remaining = current.revealed;
  const visibleSegments = characters.map((segment) => {
    const visible = segment.slice(0, remaining).join("");
    remaining = Math.max(0, remaining - segment.length);
    return visible;
  });

  return (
    <>
      {children({ segments: visibleSegments, isComplete: current.isComplete, skip })}
      <span className="sr-only" role="status" aria-live="polite">
        {enabled && current.isComplete ? completionMessage : ""}
      </span>
    </>
  );
}
