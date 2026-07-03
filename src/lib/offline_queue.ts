import { plugin } from "./native/capacitor";

export interface OfflineScanEntry {
  id: string;
  quizId: string;
  rut: string;
  answers: { q: number; a: string; s?: number[] }[];
  source: "camera" | "upload";
  dvOk?: boolean;
  code?: unknown;
  timestamp: number;
  retries: number;
}

const PREF_KEY = "tulector_offline_queue";

function prefs() {
  return plugin<{
    get: (o: { key: string }) => Promise<{ value: string | null }>;
    set: (o: { key: string; value: string }) => Promise<void>;
    remove: (o: { key: string }) => Promise<void>;
  }>("Preferences");
}

async function readQueue(): Promise<OfflineScanEntry[]> {
  const p = prefs();
  if (!p) {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  try {
    const { value } = await p.get({ key: PREF_KEY });
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

async function writeQueue(entries: OfflineScanEntry[]): Promise<void> {
  const json = JSON.stringify(entries);
  const p = prefs();
  if (!p) {
    try { localStorage.setItem(PREF_KEY, json); } catch { /* sin storage */ }
    return;
  }
  try {
    if (entries.length === 0) {
      await p.remove({ key: PREF_KEY });
    } else {
      await p.set({ key: PREF_KEY, value: json });
    }
  } catch { /* no crítico */ }
}

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function enqueueScan(entry: Omit<OfflineScanEntry, "id" | "timestamp" | "retries">): Promise<OfflineScanEntry> {
  const item: OfflineScanEntry = {
    ...entry,
    id: uuid(),
    timestamp: Date.now(),
    retries: 0,
  };
  const queue = await readQueue();
  queue.push(item);
  await writeQueue(queue);
  return item;
}

export async function dequeueScan(id: string): Promise<void> {
  const queue = await readQueue();
  const idx = queue.findIndex((e) => e.id === id);
  if (idx < 0) return;
  queue.splice(idx, 1);
  await writeQueue(queue);
}

export async function incrementRetry(id: string): Promise<void> {
  const queue = await readQueue();
  const entry = queue.find((e) => e.id === id);
  if (!entry) return;
  entry.retries++;
  await writeQueue(queue);
}

export async function getQueue(): Promise<OfflineScanEntry[]> {
  return readQueue();
}

export async function getQueueSize(): Promise<number> {
  const q = await readQueue();
  return q.length;
}

export async function clearQueue(): Promise<void> {
  await writeQueue([]);
}
