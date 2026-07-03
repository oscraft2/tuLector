import { getQueue, dequeueScan, incrementRetry, type OfflineScanEntry } from "./offline_queue";

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

function backoff(retries: number): number {
  return Math.min(BASE_DELAY_MS * Math.pow(2, retries), MAX_DELAY_MS);
}

export interface SyncProgress {
  total: number;
  succeeded: number;
  failed: number;
  current: string | null;
  done: boolean;
}

export async function syncOfflineQueue(
  onProgress?: (p: SyncProgress) => void,
): Promise<SyncProgress> {
  const queue = await getQueue();
  const progress: SyncProgress = {
    total: queue.length,
    succeeded: 0,
    failed: 0,
    current: null,
    done: false,
  };

  if (queue.length === 0) {
    progress.done = true;
    onProgress?.(progress);
    return progress;
  }

  for (const entry of queue) {
    if (entry.retries >= MAX_RETRIES) {
      progress.failed++;
      continue;
    }

    progress.current = entry.id;
    onProgress?.(progress);

    const delay = backoff(entry.retries);
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }

    let ok = false;
    try {
      const response = await fetch("/api/scan/result", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: entry.quizId,
          rut: entry.rut,
          answers: entry.answers,
          source: entry.source,
          dvOk: entry.dvOk,
          code: entry.code,
        }),
      });

      if (response.ok) {
        await dequeueScan(entry.id);
        ok = true;
        progress.succeeded++;
      } else {
        await incrementRetry(entry.id);
        progress.failed++;
      }
    } catch {
      await incrementRetry(entry.id);
      progress.failed++;
    }

    onProgress?.(progress);
  }

  progress.current = null;
  progress.done = true;
  onProgress?.(progress);
  return progress;
}

export function setupOnlineListener(onOnline: () => void): () => void {
  const handler = () => onOnline();
  if (typeof window !== "undefined") {
    window.addEventListener("online", handler);
  }
  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", handler);
    }
  };
}
