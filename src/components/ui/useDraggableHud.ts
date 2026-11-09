/**
 * Hook pro plynulé odsunutí / přetažení plovoucích HUD karet (/src/components/ui/useDraggableHud.ts).
 * Umožňuje hráči chytit libovolný informační panel za záhlaví a odsunout jej stranou,
 * aby nepřekážel výhledu na bojiště ani jiným kartám.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export function useDraggableHud() {
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      // Nepřetahovat při kliknutí na tlačítko uvnitř záhlaví
      const target = e.target as HTMLElement;
      if (target.closest("button")) return;

      e.preventDefault();
      e.stopPropagation();
      dragStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        startX: offset.x,
        startY: offset.y,
      };
      setIsDragging(true);
    },
    [offset.x, offset.y],
  );

  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.clientX;
      const dy = e.clientY - dragStartRef.current.clientY;
      setOffset({
        x: dragStartRef.current.startX + dx,
        y: dragStartRef.current.startY + dy,
      });
    };

    const onPointerEnd = () => {
      dragStartRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    window.addEventListener("blur", onPointerEnd);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      window.removeEventListener("blur", onPointerEnd);
    };
  }, [isDragging]);

  const resetOffset = useCallback(() => {
    setOffset({ x: 0, y: 0 });
  }, []);

  const hasMoved = offset.x !== 0 || offset.y !== 0;

  return {
    offset,
    isDragging,
    hasMoved,
    onPointerDown,
    resetOffset,
    dragStyle: {
      transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
    } as React.CSSProperties,
  };
}
