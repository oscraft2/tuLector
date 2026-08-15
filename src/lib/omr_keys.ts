/**
 * Pautas LOCALES de la correccion rapida (/scan/rapido).
 *
 * Viven solo en el dispositivo (localStorage), a proposito: este flujo corrige
 * pruebas que TuLector no conoce —el profesor pego un bloque en su propia
 * prueba de Word— y no identifica alumnos, asi que no hay nada que guardar en el
 * servidor: ni ensayo, ni papers "Sin RUT", ni consumo de cuota de escaneo. Si
 * el profesor quiere notas guardadas, ese es el camino de /scan/compacto con un
 * ensayo activo.
 */
import * as C from "@/tulector/compact_layout";

const STORAGE_KEY = "tulector_omr_keys";
const ACTIVE_KEY = "tulector_omr_active_key";
const STORE_VERSION = 1;

export interface OmrKey {
  id: string;
  name: string;
  /** Una entrada por pregunta: letra correcta, o "" si esa pregunta no se puntua. */
  key: string[];
  cfg: C.CompactConfig;
  createdAt: string;
}

interface OmrKeyStore {
  v: number;
  keys: OmrKey[];
}

function sanitize(raw: unknown): OmrKey | null {
  if (!raw || typeof raw !== "object") return null;
  const k = raw as Partial<OmrKey>;
  const cfg = k.cfg;
  if (!Array.isArray(k.key) || !cfg || typeof cfg.numQuestions !== "number") return null;
  return {
    id: String(k.id ?? ""),
    name: String(k.name ?? "Sin nombre"),
    key: k.key.map((letter) => String(letter ?? "").toUpperCase().slice(0, 1)),
    cfg: {
      numQuestions: cfg.numQuestions,
      numOptions: cfg.numOptions,
      ...(cfg.numColumns ? { numColumns: cfg.numColumns } : {}),
    },
    createdAt: String(k.createdAt ?? new Date().toISOString()),
  };
}

function readStorage(): OmrKey[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OmrKeyStore;
    if (!parsed || !Array.isArray(parsed.keys)) return [];
    return parsed.keys.map(sanitize).filter((k): k is OmrKey => k !== null && k.id !== "");
  } catch {
    return [];
  }
}

function persist(keys: OmrKey[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: STORE_VERSION, keys } satisfies OmrKeyStore));
  } catch { /* sin storage: la pauta vive solo en memoria durante la sesion */ }
}

// ─── Store para useSyncExternalStore ───────────────────────────
// localStorage es un sistema EXTERNO a React: la pantalla lo consume via
// useSyncExternalStore en vez de copiarlo a estado en un efecto de montaje (que
// dispara un render en cascada y, en una pagina prerenderizada, arriesga un
// desajuste de hidratacion). Por eso el snapshot se cachea: React exige que dos
// llamadas seguidas devuelvan la MISMA referencia si nada cambio.

const EMPTY: OmrKey[] = [];
let cache: OmrKey[] | null = null;
let activeCache: string | null | undefined;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeKeys(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Snapshot en el cliente (cacheado). */
export function keysSnapshot(): OmrKey[] {
  if (cache === null) cache = readStorage();
  return cache;
}

/** Snapshot en el servidor: no hay localStorage al prerenderizar. */
export function emptyKeysSnapshot(): OmrKey[] {
  return EMPTY;
}

export function activeKeyIdSnapshot(): string | null {
  if (activeCache === undefined) {
    try { activeCache = localStorage.getItem(ACTIVE_KEY); } catch { activeCache = null; }
  }
  return activeCache;
}

export function nullSnapshot(): null {
  return null;
}

export function loadKeys(): OmrKey[] {
  return keysSnapshot();
}

/** Inserta o reemplaza (por id) y devuelve la lista actualizada. */
export function saveKey(entry: OmrKey): OmrKey[] {
  const keys = keysSnapshot().filter((k) => k.id !== entry.id);
  keys.unshift(entry);
  persist(keys);
  cache = keys;
  emit();
  return keys;
}

export function deleteKey(id: string): OmrKey[] {
  const keys = keysSnapshot().filter((k) => k.id !== id);
  persist(keys);
  cache = keys;
  if (activeKeyIdSnapshot() === id) writeActiveKeyId(null);
  emit();
  return keys;
}

export function newKeyId(): string {
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function writeActiveKeyId(id: string | null): void {
  activeCache = id;
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch { /* sin storage */ }
  emit();
}

// ─── Edicion de la clave ───────────────────────────────────────

/** Letras validas para esa cantidad de opciones ("ABCDE" recortado). */
export function lettersFor(cfg: C.CompactConfig): string {
  return C.OPTION_LABELS.slice(0, cfg.numOptions);
}

/**
 * Texto libre ("ABC DEA", "a,b,c") → clave por pregunta. Los caracteres que no
 * son una opcion valida se ignoran; si falta largo, se rellena con "" (pregunta
 * no puntuable) en vez de fallar: la clave se termina de arreglar en la grilla.
 */
export function parseKeyString(text: string, cfg: C.CompactConfig): string[] {
  const valid = lettersFor(cfg);
  const letters = text.toUpperCase().split("").filter((ch) => valid.includes(ch));
  const ql = C.compactQuestionLayout(cfg);
  return Array.from({ length: ql.numQuestions }, (_, i) => letters[i] ?? "");
}

export function keyToString(key: string[]): string {
  return key.map((letter) => letter || "·").join("");
}

/** Preguntas (1-based) que quedaron sin letra: una pauta incompleta no sirve. */
export function missingAnswers(key: string[]): number[] {
  return key.flatMap((letter, i) => (letter ? [] : [i + 1]));
}
