import { useEffect, useRef, useState, type HTMLAttributes } from "react";

type ContextTarget = {
  id: number;
  position: { top: number; left: number } | null;
};

export function useComplectContextMenu() {
  const [target, setTarget] = useState<ContextTarget | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const suppressClickUntil = useRef(0);
  const touchUntil = useRef(0);
  const cancel = () => {
    clearTimeout(timer.current);
    start.current = null;
  };
  const cancelGesture = () => {
    if (start.current) suppressClickUntil.current = Date.now() + 1200;
    cancel();
  };
  useEffect(() => {
    window.addEventListener("scroll", cancelGesture, true);
    return () => {
      cancel();
      window.removeEventListener("scroll", cancelGesture, true);
    };
  }, []);
  const open = (id: number, initiator: HTMLElement, x: number, y: number) => {
    cancel();
    initiator.focus({ preventScroll: true });
    setTarget({ id, position: { left: x, top: y } });
  };
  const close = () => {
    setTarget((current) => (current ? { ...current, position: null } : null));
  };
  const rowProps = (id: number): HTMLAttributes<HTMLTableRowElement> => ({
    tabIndex: 0,
    "aria-haspopup": "menu",
    "aria-expanded": target?.id === id && Boolean(target.position),
    onContextMenu: (event) => {
      event.preventDefault();
      if (Date.now() >= touchUntil.current)
        open(id, event.currentTarget, event.clientX, event.clientY);
    },
    onKeyDown: (event) => {
      if (
        event.key !== "ContextMenu" &&
        !(event.shiftKey && event.key === "F10")
      )
        return;
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      open(id, event.currentTarget, rect.left, rect.bottom);
    },
    onPointerDown: (event) => {
      if (event.pointerType !== "touch") return;
      touchUntil.current = Date.now() + 1800;
      cancel();
      const row = event.currentTarget;
      const { clientX: x, clientY: y } = event;
      start.current = { x, y };
      timer.current = setTimeout(() => {
        suppressClickUntil.current = Date.now() + 1200;
        open(id, row, x, y);
      }, 600);
    },
    onPointerMove: (event) => {
      if (
        start.current &&
        Math.hypot(
          event.clientX - start.current.x,
          event.clientY - start.current.y
        ) > 8
      )
        cancelGesture();
    },
    onPointerUp: cancel,
    onPointerCancel: cancelGesture,
    onClickCapture: (event) => {
      if (Date.now() < suppressClickUntil.current) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
  });
  return { target, close, rowProps };
}
