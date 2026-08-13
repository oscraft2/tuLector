"use client";

import { useEffect, useRef, useState } from "react";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  /** Las que estaban sin leer justo al abrir el panel. Se marcan leidas al
   *  instante (el contador baja a cero), pero se siguen destacando mientras el
   *  panel esta abierto: si no, abrirlo borraria toda pista de cuales eran
   *  nuevas. */
  const [justOpened, setJustOpened] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef<HTMLDivElement>(null);

  /**
   * Carga inicial + latido de cada minuto (refresca el reloj de los "hace X
   * min" y vuelve a pedir la lista).
   *
   * El refresco hace falta porque el campanario vive en el layout del
   * dashboard: navegar entre paginas NO lo vuelve a montar, asi que sin esto
   * una notificacion nueva (ej. "te compartieron un ensayo") no aparecia hasta
   * recargar el navegador a mano. Con la pestaña en segundo plano no se pide
   * nada.
   */
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/notifications", { credentials: "include" });
        if (!res.ok || !alive) return;
        const data = await res.json();
        const items = (data.notifications ?? []) as Notification[];
        if (!alive) return;
        setList(items);
        setUnread(items.filter((n) => !n.read_at).length);
      } catch { /* sin conexión */ }
    };
    load();
    const timer = setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === "visible") load();
    }, 60000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  /**
   * Marca leidas en el servidor. `keepalive` es lo que arregla el bug de fondo:
   * al hacer clic en una notificacion con enlace se navegaba en el mismo tick,
   * el navegador cancelaba este fetch a medio camino y el `read_at` nunca se
   * guardaba — al volver, el numerito seguia ahi.
   */
  const persistRead = (payload: { ids?: string[]; all?: boolean }) => {
    try {
      void fetch("/api/notifications", {
        method: "PATCH",
        credentials: "include",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, read_at: new Date().toISOString() }),
      });
    } catch { /* best effort: la marca local ya se aplico */ }
  };

  const markAsRead = (id: string) => {
    const target = list.find((n) => n.id === id);
    if (!target || target.read_at) return; // ya estaba leida: no se toca la fecha
    setList((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    setUnread((prev) => Math.max(0, prev - 1));
    persistRead({ ids: [id] });
  };

  /**
   * Abrir el panel ES leerlas: mirar la lista y que el numerito siguiera igual
   * era justamente lo que no calzaba. Se marcan las que se muestran, no `all`,
   * para no borrar de un plumazo alguna que llego despues de cargar la lista y
   * que el usuario todavia no vio.
   */
  const openPanel = () => {
    setOpen(true);
    const unreadIds = list.filter((n) => !n.read_at).map((n) => n.id);
    setJustOpened(new Set(unreadIds));
    if (unreadIds.length === 0) return;
    setList((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
    setUnread(0);
    persistRead({ ids: unreadIds });
  };

  const iconFor = (type: string) => {
    if (type === "quota") return "⚡";
    if (type === "scan") return "📄";
    if (type === "team") return "👥";
    if (type === "share") return "🤝";
    return "🔔";
  };

  // El "hace X min" se calcula contra un reloj guardado en estado y refrescado
  // cada minuto (ver el efecto de arriba): leer Date.now() durante el render es
  // impuro y ademas dejaba los tiempos congelados en el valor del primer pintado.
  const relativeTime = (ts: string) => {
    const diff = now - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "ahora";
    if (mins < 60) return `hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs} h`;
    return `hace ${Math.floor(hrs / 24)} d`;
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => (open ? setOpen(false) : openPanel())}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[#e6e8eb] bg-white text-[#5b6472] hover:bg-[#f4f6f8] transition"
        aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : "Notificaciones"}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#c2410c] px-1 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-[#e1e5ea] bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-[#eef0f3] px-4 py-3">
            <p className="text-sm font-semibold text-[#111827]">Notificaciones</p>
            {/* Cuantas eran nuevas AL ABRIR: el contador de arriba ya esta en
                cero (abrirlas es leerlas), pero sigue siendo util saberlo. */}
            {justOpened.size > 0 && <span className="text-xs text-[#5b6472]">{justOpened.size} nueva{justOpened.size === 1 ? "" : "s"}</span>}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {list.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[#5b6472]">Sin notificaciones</p>
            ) : (
              list.slice(0, 10).map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    markAsRead(n.id);
                    if (n.link) {
                      setOpen(false);
                      window.location.href = n.link;
                    }
                  }}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[#f4f6f8] ${justOpened.has(n.id) ? "bg-blue-50/30" : ""}`}
                >
                  <span className="mt-0.5 text-lg">{iconFor(n.type)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#111827] truncate">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-[#5b6472] line-clamp-2">{n.body}</p>}
                    <p className="mt-1 text-[10px] text-[#9aa3af]">{relativeTime(n.created_at)}</p>
                  </div>
                  {justOpened.has(n.id) && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#07305f]" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
