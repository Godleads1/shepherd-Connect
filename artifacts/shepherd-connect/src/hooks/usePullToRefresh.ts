import { useState, useEffect, useRef, useCallback } from "react";

const THRESHOLD = 72;   // px — how far to pull before triggering
const MAX_PULL  = 110;  // px — visual clamp so it doesn't stretch too far

export type PullState = {
  pullDistance: number;   // 0..MAX_PULL — drive your visual transform
  isRefreshing: boolean;
  triggered: boolean;     // true once threshold crossed (before release)
};

/**
 * Attach pull-to-refresh to the document.
 * Only fires when the page is scrolled to the very top (scrollY === 0).
 *
 * @param onRefresh  async callback — spinner shows until it resolves
 */
export function usePullToRefresh(
  onRefresh: () => Promise<void> | void,
): PullState {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [triggered, setTriggered] = useState(false);

  const startY          = useRef(0);
  const isPulling       = useRef(false);
  const isRefreshingRef = useRef(false);
  const distRef         = useRef(0);

  const doRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    setPullDistance(0);
    setTriggered(false);
    distRef.current = 0;
    try {
      await onRefresh();
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [onRefresh]);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0 && !isRefreshingRef.current) {
        startY.current = e.touches[0].clientY;
        isPulling.current = true;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || isRefreshingRef.current) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        isPulling.current = false;
        distRef.current = 0;
        setPullDistance(0);
        setTriggered(false);
        return;
      }
      // prevent the browser's native overscroll / bounce while we're pulling
      e.preventDefault();
      const clamped = Math.min(delta, MAX_PULL);
      distRef.current = clamped;
      setPullDistance(clamped);
      setTriggered(clamped >= THRESHOLD);
    };

    const onTouchEnd = () => {
      if (!isPulling.current) return;
      isPulling.current = false;
      if (distRef.current >= THRESHOLD) {
        doRefresh();
      } else {
        distRef.current = 0;
        setPullDistance(0);
        setTriggered(false);
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove",  onTouchMove,  { passive: false });
    document.addEventListener("touchend",   onTouchEnd);

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove",  onTouchMove);
      document.removeEventListener("touchend",   onTouchEnd);
    };
  }, [doRefresh]);

  return { pullDistance, isRefreshing, triggered };
}
