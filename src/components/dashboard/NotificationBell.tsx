"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [justOpened, setJustOpened] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef<HTMLDivElement>(null);
  const lastFetchRef = useRef(0);

  useEffect(() => {
    let alive = true;
    const load = async (force = false) => {
      const ts = Date.now();
      if (!force && ts - lastFetchRef.current < 2000) return;
      lastFetchRef.current = ts;
      try {
        const res = await fetch("/api/notifications", { credentials: "include" });
        if (!res.ok || !alive) return;
        const data = await res.json();
        const items = (data.notifications ?? []) as Notification[];
        if (!alive) return;
        setList(items);
        setUnread(items.filter((n) => !n.read_at).length);
      } catch {
        /* sin conexión */
      }
    };
    load(true);
    const timer = setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === "visible") load();
    }, 60000);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const persistRead = (payload: { ids?: string[]; all?: boolean }) => {
    try {
      void fetch("/api/notifications", {
        method: "PATCH",
        credentials: "include",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, read_at: new Date().toISOString() }),
      });
    } catch {
      /* best effort: la marca local ya se aplicó */
    }
  };

  const markAsRead = (id: string) => {
    const target = list.find((n) => n.id === id);
    if (!target || target.read_at) return;
    setList((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    setUnread((prev) => Math.max(0, prev - 1));
    persistRead({ ids: [id] });
  };

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
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-expanded={open}
        aria-haspopup="menu"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[#e7e5df] bg-white text-[#57534e] transition hover:bg-[#f7f6f2]"
        aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : "Notificaciones"}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        {unread > 0 && (
          <span className="tnum absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#c2410c] px-1 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-[#e7e5df] bg-white shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-[#efede8] px-4 py-3">
            <p className="text-sm font-semibold text-[#1c1917]">Notificaciones</p>
            {justOpened.size > 0 && (
              <span className="text-xs text-[#78716c]">
                {justOpened.size} nueva{justOpened.size === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {list.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[#78716c]">Sin notificaciones</p>
            ) : (
              list.slice(0, 10).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    markAsRead(n.id);
                    if (n.link) {
                      setOpen(false);
                      if (n.link.startsWith("/")) {
                        router.push(n.link);
                      } else {
                        window.location.href = n.link;
                      }
                    }
                  }}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[#faf9f6] ${
                    justOpened.has(n.id) ? "bg-[#f5f8ff]" : ""
                  }`}
                >
                  <span className="mt-0.5 text-lg" aria-hidden="true">
                    {iconFor(n.type)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#1c1917]">{n.title}</p>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-[#57534e]">{n.body}</p>}
                    <p className="mt-1 text-[10px] text-[#78716c]">{relativeTime(n.created_at)}</p>
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
