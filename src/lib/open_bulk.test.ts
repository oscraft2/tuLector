import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { celdasParaPuntaje, cumpleEstado, guardarLoteAbiertas, validarLote } from "./open_bulk";

const MAXIMOS = new Map([[6, 1], [18, 2]]);

test("filtro de estado: pendientes y revisadas miran solo las preguntas visibles", () => {
  const confirmadas = new Set(["a:6", "a:18", "b:6"]);
  const pasan = (estado: string, preguntas = [6, 18]) => ["a", "b", "c"].filter((id) => cumpleEstado(id, preguntas, confirmadas, estado));
  assert.deepEqual(pasan(""), ["a", "b", "c"]);
  assert.deepEqual(pasan("pendientes"), ["b", "c"]);
  assert.deepEqual(pasan("revisadas"), ["a"]);
  assert.deepEqual(pasan("revisadas", [6]), ["a", "b"]);
});

test("puntaje masivo: por defecto no toca lo ya guardado", () => {
  const r = celdasParaPuntaje({ paperIds: ["a", "b"], preguntas: [6, 18], puntos: 0, maximos: MAXIMOS, confirmadas: new Set(["a:6"]), reemplazar: false });
  assert.equal(r.items.length, 3);
  assert.equal(r.yaGuardadas, 1);
  assert.equal(r.reemplazadas, 0);
  assert.ok(!r.items.some((i) => i.paperId === "a" && i.question === 6));
});

test("puntaje masivo: reemplazar incluye lo guardado y lo cuenta", () => {
  const r = celdasParaPuntaje({ paperIds: ["a", "b"], preguntas: [6], puntos: 1, maximos: MAXIMOS, confirmadas: new Set(["a:6"]), reemplazar: true });
  assert.equal(r.items.length, 2);
  assert.equal(r.reemplazadas, 1);
});

test("puntaje masivo: un 2 nunca cae en una pregunta de máximo 1", () => {
  const r = celdasParaPuntaje({ paperIds: ["a"], preguntas: [6, 18], puntos: 2, maximos: MAXIMOS, confirmadas: new Set(), reemplazar: false });
  assert.deepEqual(r.items, [{ paperId: "a", question: 18, points: 2 }]);
  assert.deepEqual(r.sinMaximoSuficiente, [6]);
});

test("validar lote: todo o nada", () => {
  const validos = new Set(["a"]);
  const bueno = { paperId: "a", question: 18, points: 2 };
  for (const malo of [
    { paperId: "otro", question: 18, points: 0 },
    { paperId: "a", question: 7, points: 0 },
    { paperId: "a", question: 6, points: 2 },
    { paperId: "a", question: 6, points: -1 },
    { paperId: "a", question: 6, points: Number.NaN },
    { paperId: "a", question: 6, points: "1" },
  ]) {
    assert.ok("error" in validarLote([bueno, malo], validos, MAXIMOS), JSON.stringify(malo));
  }
  assert.ok("error" in validarLote([], validos, MAXIMOS));
  assert.deepEqual(validarLote([bueno, { ...bueno, points: 1 }], validos, MAXIMOS), { items: [{ ...bueno, points: 1 }] });
});

// ─── Guardado contra una base falsa ─────────────────────────────────────

function baseFalsa() {
  const upserts: Record<string, unknown>[] = [];
  const tablas: Record<string, Record<string, unknown>[]> = {
    quizzes: [{ id: "q", school_id: "colegio", num_questions: 20, open_questions: "6,18", score_open_questions: false,
      open_question_rubrics: JSON.stringify({ 6: { rubric: "Respuesta correcta: 36.", max_points: 1 }, 18: { rubric: "x", max_points: 2 } }) }],
    papers: [
      { id: "a", quiz_id: "q", school_id: "colegio", status: "active" },
      { id: "b", quiz_id: "q", school_id: "colegio", status: "active" },
      { id: "anulada", quiz_id: "q", school_id: "colegio", status: "void" },
      { id: "ajena", quiz_id: "q", school_id: "otro", status: "active" },
    ],
    open_answers: [{ paper_id: "a", question: 6, confirmed_points: 1 }, { paper_id: "b", question: 6, confirmed_points: null }],
  };
  const consulta = (tabla: string) => {
    let filas = tablas[tabla];
    const api = {
      select: () => api,
      eq: (k: string, v: unknown) => { filas = filas.filter((f) => f[k] === v); return api; },
      neq: (k: string, v: unknown) => { filas = filas.filter((f) => f[k] !== v); return api; },
      in: (k: string, v: unknown[]) => { filas = filas.filter((f) => v.includes(f[k])); return api; },
      single: async () => ({ data: filas[0] ?? null, error: filas[0] ? null : { message: "no" } }),
      upsert: async (nuevas: Record<string, unknown>[]) => { upserts.push(...nuevas); return { error: null }; },
      then: (resolver: (v: unknown) => unknown) => resolver({ data: filas, error: null }),
    };
    return api;
  };
  return { db: { from: consulta } as unknown as SupabaseClient, upserts };
}

const base = { schoolId: "colegio", quizId: "q", ahora: "2026-11-27T00:00:00Z" };

test("guardar: solo sin revisar no pisa lo confirmado (aunque el navegador lo pida)", async () => {
  const { db, upserts } = baseFalsa();
  const r = await guardarLoteAbiertas(db, { ...base, soloSinRevisar: true, items: [
    { paperId: "a", question: 6, points: 0 }, { paperId: "b", question: 6, points: 0 }, { paperId: "b", question: 18, points: 2 },
  ] });
  assert.ok(r.ok);
  assert.equal(r.guardadas, 2);
  assert.equal(r.omitidas, 1);
  assert.deepEqual(upserts.map((f) => `${f.paper_id}:${f.question}=${f.confirmed_points}/${f.max_points}`), ["b:6=0/1", "b:18=2/2"]);
  assert.ok(upserts.every((f) => !("transcripcion" in f) && !("puntaje" in f)));
});

test("guardar: una hoja descartada o de otro colegio rechaza todo el lote", async () => {
  for (const paperId of ["anulada", "ajena", "inventada"]) {
    const { db, upserts } = baseFalsa();
    const r = await guardarLoteAbiertas(db, { ...base, soloSinRevisar: false, items: [{ paperId: "a", question: 6, points: 1 }, { paperId, question: 6, points: 1 }] });
    assert.equal(r.ok, false, paperId);
    assert.equal(upserts.length, 0);
  }
});

test("guardar: otro colegio no puede escribir en el ensayo", async () => {
  const { db, upserts } = baseFalsa();
  const r = await guardarLoteAbiertas(db, { ...base, schoolId: "otro", soloSinRevisar: false, items: [{ paperId: "ajena", question: 6, points: 1 }] });
  assert.equal(r.ok, false);
  assert.equal(upserts.length, 0);
});
