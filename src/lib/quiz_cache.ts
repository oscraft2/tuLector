/**
 * Cache local del ensayo activo, para poder corregir SIN RED.
 *
 * El motor OMR siempre corrio en el cliente, asi que leer una hoja nunca
 * necesito internet. Lo que si venia del servidor era la PAUTA y el formato
 * (`/api/scan/active-quiz`). Sin conexion esa llamada falla, y hasta ahora el
 * escaner se quedaba con una clave de demo hardcodeada: el profesor veia un
 * puntaje que no significaba nada. Guardando el ensayo aca, offline se corrige
 * contra la pauta REAL.
 *
 * Solo se guarda informacion del ensayo (pauta y formato), no datos de alumnos.
 * Las lecturas, que si llevan RUT, siguen yendo a la cola cifrada de
 * offline_queue.ts (Android Keystore / iOS Keychain).
 */

export interface CachedScanConfig {
  numQuestions: number;
  numOptions: number;
  numColumns: number;
  optionLabels: string;
  openQuestions: number[];
  optionOverrides: Record<number, number>;
  multiSelectQuestions: number[];
  openBoxesPerPage: number;
}

export interface CachedQuiz {
  quizId: string;
  /** Clave real del ensayo, ya normalizada a letras. */
  answerKey: string[];
  sheetCode: number | null;
  countryCode: string;
  cfg: CachedScanConfig;
  title?: string;
  savedAt: number;
}

/** Guarda el ensayo activo. Silencioso ante fallos: es una optimizacion, no un requisito. */
export function saveQuizPack(key: string, pack: CachedQuiz): void {
  try {
    localStorage.setItem(key, JSON.stringify(pack));
  } catch {
    // sin storage disponible (modo privado, cuota): se sigue sin cache
  }
}

/** Recupera el ensayo cacheado, o null si no hay o esta corrupto. */
export function loadQuizPack(key: string): CachedQuiz | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedQuiz;
    // Validacion minima: sin id o sin config no sirve para corregir.
    if (!parsed?.quizId || !parsed?.cfg?.numQuestions) return null;
    return parsed;
  } catch {
    return null;
  }
}
