import assert from "node:assert/strict";
import test from "node:test";
import { computeQuizScore, type ScoreableQuiz } from "./quiz_score";

const SCHOOL = {};
const CL = "CL";

/** Clave de 20 preguntas: A B C D E repetido. */
const KEY_20 = "ABCDEABCDEABCDEABCDE";

/** Respuestas del alumno a partir de una clave: acierta las que se le pidan. */
function answersHitting(correctQs: number[], key = KEY_20, numQ = 20) {
  const hit = new Set(correctQs);
  return Array.from({ length: numQ }, (_, i) => {
    const q = i + 1;
    const expected = key[i];
    // Para fallar se responde una letra distinta de la correcta.
    const wrong = expected === "A" ? "B" : "A";
    return { q, a: hit.has(q) ? expected : wrong };
  });
}

const BASE: ScoreableQuiz = { answer_key: KEY_20, num_questions: 20 };

// ─────────────────────────────────────────────────────────────────────────────
// GUARDIA DE NO-REGRESION: un ensayo sin nada configurado se comporta EXACTO
// como antes de existir el puntaje por pregunta.
// ─────────────────────────────────────────────────────────────────────────────

test("sin ponderacion, points === score y pointsTotal === total", () => {
  const cases = [
    { name: "todas correctas", correct: Array.from({ length: 20 }, (_, i) => i + 1) },
    { name: "ninguna correcta", correct: [] },
    { name: "12 de 20", correct: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  ];
  for (const c of cases) {
    const r = computeQuizScore(BASE, answersHitting(c.correct), SCHOOL, CL);
    assert.equal(r.points, r.score, c.name);
    assert.equal(r.pointsTotal, r.total, c.name);
    assert.equal(r.score, c.correct.length, c.name);
    assert.equal(r.total, 20, c.name);
  }
});

test("sin ponderacion, con abiertas y seleccion multiple, sigue igual que antes", () => {
  const quiz: ScoreableQuiz = {
    ...BASE,
    open_questions: "18,19",
    multi_select_questions: "20",
  };
  // Acierta 1..10; las 18,19,20 no cuentan ni aunque vengan respondidas.
  const r = computeQuizScore(quiz, answersHitting([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), SCHOOL, CL);
  assert.equal(r.total, 17, "20 - 2 abiertas - 1 multiple");
  assert.equal(r.score, 10);
  assert.equal(r.points, r.score);
  assert.equal(r.pointsTotal, r.total);
});

test("sin ponderacion, una clave con huecos '-' no cuenta esas preguntas como correctas", () => {
  const quiz: ScoreableQuiz = { answer_key: "AB--EABCDEABCDEABCDE", num_questions: 20 };
  const answers = [{ q: 3, a: "-" }, { q: 4, a: "C" }, { q: 1, a: "A" }];
  const r = computeQuizScore(quiz, answers, SCHOOL, CL);
  assert.equal(r.score, 1, "solo la 1; la 3 esta en blanco y la 4 no tiene clave");
  assert.equal(r.points, r.score);
});

test("la nota de un ensayo sin configurar es la de siempre (60% de exigencia, escala 1-7)", () => {
  // 12/20 = 60% exacto = nota de aprobacion 4.0
  const r = computeQuizScore(BASE, answersHitting([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), SCHOOL, CL);
  assert.equal(r.grade, 4.0);
  assert.equal(r.passing, true);
  // 100% = 7.0
  const perfect = computeQuizScore(BASE, answersHitting(Array.from({ length: 20 }, (_, i) => i + 1)), SCHOOL, CL);
  assert.equal(perfect.grade, 7.0);
  // 0% = 1.0
  const zero = computeQuizScore(BASE, answersHitting([]), SCHOOL, CL);
  assert.equal(zero.grade, 1.0);
  assert.equal(zero.passing, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// PUNTAJE POR PREGUNTA
// ─────────────────────────────────────────────────────────────────────────────

test("ponderacion: overrides suman al total y solo los aciertos al numerador", () => {
  const quiz: ScoreableQuiz = { ...BASE, question_points: "3:2,7:3" };
  // 20 preguntas: 18 de 1 pt + una de 2 + una de 3 = 23 pts
  const r = computeQuizScore(quiz, answersHitting([3, 7]), SCHOOL, CL);
  assert.equal(r.pointsTotal, 23);
  assert.equal(r.points, 5, "2 + 3");
  assert.equal(r.score, 2, "correctas sigue contando preguntas, no puntos");
  assert.equal(r.total, 20);
});

test("ponderacion: default_question_points aplica a las que no tienen override", () => {
  const quiz: ScoreableQuiz = { ...BASE, default_question_points: 2, question_points: "5:0.5" };
  // 19 preguntas x 2 + una de 0.5 = 38.5
  const r = computeQuizScore(quiz, answersHitting([1, 5]), SCHOOL, CL);
  assert.equal(r.pointsTotal, 38.5);
  assert.equal(r.points, 2.5, "1 vale 2, la 5 vale 0.5");
});

test("ponderacion: acepta decimales con punto y con coma", () => {
  const conPunto = computeQuizScore({ ...BASE, question_points: "4:0.5" }, answersHitting([4]), SCHOOL, CL);
  const conComa = computeQuizScore({ ...BASE, question_points: "4:0,5" }, answersHitting([4]), SCHOOL, CL);
  assert.equal(conPunto.points, 0.5);
  assert.equal(conComa.points, 0.5);
  assert.equal(conPunto.pointsTotal, conComa.pointsTotal);
  assert.equal(conPunto.pointsTotal, 19.5);
});

test("ponderacion: una pregunta abierta o multiple NO recibe puntaje aunque tenga override", () => {
  const quiz: ScoreableQuiz = {
    ...BASE,
    open_questions: "18",
    multi_select_questions: "20",
    question_points: "18:5,20:5,1:3",
  };
  // Cerradas = 1..17 y 19 (18 preguntas): 17 de 1 pt + la 1 que vale 3 => 20
  const r = computeQuizScore(quiz, answersHitting([1]), SCHOOL, CL);
  assert.equal(r.pointsTotal, 20);
  assert.equal(r.points, 3);
});

test("ponderacion: la coma separa pares, pero dentro de un par es decimal", () => {
  const r = computeQuizScore({ ...BASE, question_points: "4:0,5,7:3" }, answersHitting([4, 7]), SCHOOL, CL);
  assert.equal(r.points, 3.5, "0.5 de la 4 + 3 de la 7");
  assert.equal(r.pointsTotal, 21.5, "18 de 1 pt + 0.5 + 3");
});

test("ponderacion: puntaje 0 en todas cae al conteo de correctas en vez de dividir por cero", () => {
  const quiz: ScoreableQuiz = { ...BASE, default_question_points: 0 };
  const r = computeQuizScore(quiz, answersHitting([1, 2, 3]), SCHOOL, CL);
  assert.equal(r.points, r.score);
  assert.equal(r.pointsTotal, r.total);
  assert.equal(r.grade > 1.0, true, "la nota sigue siendo calculable");
});

// ─────────────────────────────────────────────────────────────────────────────
// PREGUNTAS DE DESARROLLO EN EL PUNTAJE
// ─────────────────────────────────────────────────────────────────────────────

const RUBRICS = JSON.stringify({
  "19": { rubric: "criterio", max_points: 2, subtipo: "simple" },
  "20": { rubric: "criterio", max_points: 4, subtipo: "simple" },
});

test("abiertas: con score_open_questions apagado no tocan el puntaje", () => {
  const quiz: ScoreableQuiz = {
    ...BASE, open_questions: "19,20", open_question_rubrics: RUBRICS,
  };
  const r = computeQuizScore(quiz, answersHitting([1, 2]), SCHOOL, CL, [
    { question: 19, confirmed_points: 2 },
  ]);
  assert.equal(r.pointsTotal, 18, "solo las 18 cerradas");
  assert.equal(r.points, 2);
});

test("abiertas: encendido, el max_points suma al denominador y solo lo confirmado al numerador", () => {
  const quiz: ScoreableQuiz = {
    ...BASE, open_questions: "19,20", open_question_rubrics: RUBRICS, score_open_questions: true,
  };
  // 18 cerradas + 2 + 4 = 24 pts
  const r = computeQuizScore(quiz, answersHitting([1, 2]), SCHOOL, CL, [
    { question: 19, confirmed_points: 2 },
    { question: 20, confirmed_points: null }, // sugerida por la IA, sin confirmar
  ]);
  assert.equal(r.pointsTotal, 24);
  assert.equal(r.points, 4, "2 cerradas + 2 confirmados; la 20 sin confirmar suma 0");
});

test("abiertas: sin ninguna confirmacion la nota queda deprimida, no rota", () => {
  const quiz: ScoreableQuiz = {
    ...BASE, open_questions: "19,20", open_question_rubrics: RUBRICS, score_open_questions: true,
  };
  const r = computeQuizScore(quiz, answersHitting(Array.from({ length: 18 }, (_, i) => i + 1)), SCHOOL, CL, []);
  assert.equal(r.pointsTotal, 24);
  assert.equal(r.points, 18, "todas las cerradas, ninguna abierta");
  assert.equal(r.score, 18);
});

test("abiertas: un confirmed_points mayor al maximo de la rubrica se recorta", () => {
  const quiz: ScoreableQuiz = {
    ...BASE, open_questions: "19,20", open_question_rubrics: RUBRICS, score_open_questions: true,
  };
  const r = computeQuizScore(quiz, answersHitting([]), SCHOOL, CL, [
    { question: 19, confirmed_points: 99 },
  ]);
  assert.equal(r.points, 2, "recortado al max_points de la 19");
});

test("abiertas: una abierta sin rubrica cargada no aporta ni al total ni al puntaje", () => {
  const quiz: ScoreableQuiz = {
    ...BASE, open_questions: "19,20",
    open_question_rubrics: JSON.stringify({ "19": { rubric: "c", max_points: 2, subtipo: "simple" } }),
    score_open_questions: true,
  };
  const r = computeQuizScore(quiz, answersHitting([]), SCHOOL, CL, []);
  assert.equal(r.pointsTotal, 20, "18 cerradas + 2 de la 19; la 20 no tiene rubrica");
});

// ─────────────────────────────────────────────────────────────────────────────
// PUNTAJE EQUIVALENTE
// ─────────────────────────────────────────────────────────────────────────────

test("el puntaje equivalente se calcula sobre los PUNTOS, no sobre las correctas", () => {
  // 20 preguntas, la 1 vale 20 pts => total 39. Acertar solo la 1 = 20/39 = 51%
  const quiz: ScoreableQuiz = { ...BASE, question_points: "1:20", evaluation_type: "paes" };
  const r = computeQuizScore(quiz, answersHitting([1]), SCHOOL, CL);
  assert.equal(r.pointsTotal, 39);
  assert.equal(r.points, 20);
  assert.equal(r.equivalentScore, Math.round(100 + (20 / 39) * 900));
  assert.equal(r.score, 1, "una sola correcta");
});

test("escala equivalente propia: se usa cuando el ensayo la define", () => {
  const quiz: ScoreableQuiz = { ...BASE, equivalent_scale: JSON.stringify({ min: 150, max: 850 }) };
  const r = computeQuizScore(quiz, answersHitting(Array.from({ length: 10 }, (_, i) => i + 1)), SCHOOL, CL);
  assert.equal(r.equivalentScore, 500, "50% de 150-850");
});

test("escala equivalente propia: PAES/SIMCE le ganan (son formulas oficiales)", () => {
  const quiz: ScoreableQuiz = {
    ...BASE, evaluation_type: "paes", equivalent_scale: JSON.stringify({ min: 0, max: 10 }),
  };
  const r = computeQuizScore(quiz, answersHitting(Array.from({ length: 10 }, (_, i) => i + 1)), SCHOOL, CL);
  assert.equal(r.equivalentScore, 550, "100 + 50% * 900");
});

test("escala equivalente propia: un JSON roto cae al porcentaje simple", () => {
  const quiz: ScoreableQuiz = { ...BASE, equivalent_scale: "{no es json" };
  const r = computeQuizScore(quiz, answersHitting(Array.from({ length: 10 }, (_, i) => i + 1)), SCHOOL, CL);
  assert.equal(r.equivalentScore, 50);
});

// ─────────────────────────────────────────────────────────────────────────────
// ESCALA DE NOTA POR ENSAYO
// ─────────────────────────────────────────────────────────────────────────────

test("nota minima de aprobacion propia del ensayo: cambia el punto de corte", () => {
  // 12/20 = 60% = exigencia justa => la nota es la de aprobacion, sea cual sea.
  const answers = answersHitting([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const conDefault = computeQuizScore(BASE, answers, SCHOOL, CL);
  const conPropia = computeQuizScore({ ...BASE, passing_grade: 5.0 }, answers, SCHOOL, CL);
  assert.equal(conDefault.grade, 4.0);
  assert.equal(conPropia.grade, 5.0);
  assert.equal(conPropia.passing, true);
});

test("escala propia del ensayo: 0-100 en vez de 1-7", () => {
  const quiz: ScoreableQuiz = { ...BASE, grade_scale_min: 0, grade_scale_max: 100, passing_grade: 60 };
  const perfect = computeQuizScore(quiz, answersHitting(Array.from({ length: 20 }, (_, i) => i + 1)), SCHOOL, CL);
  assert.equal(perfect.grade, 100);
  const zero = computeQuizScore(quiz, answersHitting([]), SCHOOL, CL);
  assert.equal(zero.grade, 0);
});

test("el ensayo le gana al colegio en cada campo de la escala", () => {
  const school = { grading_scale_min: 1.0, grading_scale_max: 7.0, passing_grade: 4.0, exigencia: 0.6 };
  const quiz: ScoreableQuiz = { ...BASE, passing_grade: 5.0 };
  const r = computeQuizScore(quiz, answersHitting([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), school, CL);
  assert.equal(r.grade, 5.0, "manda el passing_grade del ensayo, no el del colegio");
});

const TABLA_20 = JSON.stringify({
  mode: "points",
  rows: [{ from: 0, grade: 1.0 }, { from: 12, grade: 4.0 }, { from: 20, grade: 7.0 }],
});

test("tabla puntaje->nota: los tramos declarados dan la nota exacta", () => {
  const quiz: ScoreableQuiz = { ...BASE, grade_table: TABLA_20 };
  const en12 = computeQuizScore(quiz, answersHitting(Array.from({ length: 12 }, (_, i) => i + 1)), SCHOOL, CL);
  assert.equal(en12.grade, 4.0);
  const en20 = computeQuizScore(quiz, answersHitting(Array.from({ length: 20 }, (_, i) => i + 1)), SCHOOL, CL);
  assert.equal(en20.grade, 7.0);
  const en0 = computeQuizScore(quiz, answersHitting([]), SCHOOL, CL);
  assert.equal(en0.grade, 1.0);
});

test("tabla puntaje->nota: entre dos tramos interpola", () => {
  const quiz: ScoreableQuiz = { ...BASE, grade_table: TABLA_20 };
  // 16 pts esta a mitad de camino entre 12 (4.0) y 20 (7.0) => 5.5
  const r = computeQuizScore(quiz, answersHitting(Array.from({ length: 16 }, (_, i) => i + 1)), SCHOOL, CL);
  assert.equal(r.grade, 5.5);
});

test("tabla puntaje->nota: manda sobre la formula de exigencia", () => {
  const answers = answersHitting(Array.from({ length: 16 }, (_, i) => i + 1));
  const conFormula = computeQuizScore(BASE, answers, SCHOOL, CL);
  const conTabla = computeQuizScore({ ...BASE, grade_table: TABLA_20 }, answers, SCHOOL, CL);
  assert.equal(conFormula.grade, 5.5, "80% con exigencia 60% da 5.5 por casualidad numerica");
  assert.equal(conTabla.grade, 5.5);
  // Con una tabla distinta se separa de la formula, que es el punto.
  const otra = JSON.stringify({ mode: "points", rows: [{ from: 0, grade: 1.0 }, { from: 20, grade: 7.0 }] });
  const conOtra = computeQuizScore({ ...BASE, grade_table: otra }, answers, SCHOOL, CL);
  assert.equal(conOtra.grade, 5.8, "16/20 lineal de 1.0 a 7.0");
});

test("tabla puntaje->nota: passing se mide contra la nota de aprobacion, no el porcentaje", () => {
  // Tabla generosa: 8 puntos (40% de logro) ya vale 4.0.
  const tabla = JSON.stringify({ mode: "points", rows: [{ from: 0, grade: 1.0 }, { from: 8, grade: 4.0 }, { from: 20, grade: 7.0 }] });
  const r = computeQuizScore({ ...BASE, grade_table: tabla }, answersHitting([1, 2, 3, 4, 5, 6, 7, 8]), SCHOOL, CL);
  assert.equal(r.grade, 4.0);
  assert.equal(r.passing, true, "con la formula de exigencia 40% habria reprobado");
});

test("tabla puntaje->nota: modo porcentaje", () => {
  const tabla = JSON.stringify({ mode: "percent", rows: [{ from: 0, grade: 1.0 }, { from: 60, grade: 4.0 }, { from: 100, grade: 7.0 }] });
  const r = computeQuizScore({ ...BASE, grade_table: tabla }, answersHitting(Array.from({ length: 12 }, (_, i) => i + 1)), SCHOOL, CL);
  assert.equal(r.grade, 4.0, "12/20 = 60%");
});

test("tabla puntaje->nota: una tabla rota cae a la formula de siempre", () => {
  const answers = answersHitting(Array.from({ length: 12 }, (_, i) => i + 1));
  const esperado = computeQuizScore(BASE, answers, SCHOOL, CL).grade;
  for (const rota of ["{no es json", "{}", JSON.stringify({ mode: "points", rows: [] }), JSON.stringify({ rows: "x" })]) {
    const r = computeQuizScore({ ...BASE, grade_table: rota }, answers, SCHOOL, CL);
    assert.equal(r.grade, esperado, `tabla rota: ${rota}`);
  }
});

test("tabla puntaje->nota: funciona sobre los PUNTOS ponderados, no las correctas", () => {
  // La 1 vale 12 pts; acertarla sola da 12 puntos => 4.0 segun la tabla.
  const quiz: ScoreableQuiz = { ...BASE, question_points: "1:12", grade_table: TABLA_20 };
  const r = computeQuizScore(quiz, answersHitting([1]), SCHOOL, CL);
  assert.equal(r.points, 12);
  assert.equal(r.grade, 4.0);
  assert.equal(r.score, 1, "una sola correcta, pero 12 puntos");
});
