"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const THRESHOLD = 70;
const MAX_PULL = 110;

/**
 * Pull-to-refresh para las listas nativas (Resultados, Alumnos): antes, si
 * algo cambiaba (un colega escaneo, se agrego un alumno desde otro
 * dispositivo), habia que salir de la pantalla y volver a entrar para verlo.
 * Usa router.refresh() (re-ejecuta los Server Components de la ruta actual
 * sin recargar toda la pagina) — no pide datos por su cuenta, solo dispara
 * el mismo mecanismo que ya usa Next.js.
 */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pull, setPull] = useState(0);
  const startY = useRef<number | null>(null);
  const dragging = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 0) {
      startY.current = e.touches[0].clientY;
      dragging.current = true;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current || startY.current === null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) {
      setPull(0);
      return;
    }
    // Damping: se siente "elastico", no 1:1 con el dedo.
    setPull(Math.min(delta * 0.5, MAX_PULL));
  };

  const onTouchEnd = () => {
    if (pull >= THRESHOLD && !pending) {
      startTransition(() => router.refresh());
    }
    setPull(0);
    startY.current = null;
    dragging.current = false;
  };

  const showSpinner = pull > 0 || pending;
  const indicatorHeight = pending ? 44 : pull;

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{ height: indicatorHeight, transition: dragging.current ? "none" : "height 0.2s ease-out" }}
      >
        {showSpinner ? (
          <div
            className={`h-6 w-6 rounded-full border-2 border-[#07305f] border-t-transparent ${pending || pull >= THRESHOLD ? "animate-spin" : ""}`}
            style={{ opacity: Math.min(pull / THRESHOLD, 1), transform: `rotate(${pull * 3}deg)` }}
          />
        ) : null}
      </div>
      {children}
    </div>
  );
}
