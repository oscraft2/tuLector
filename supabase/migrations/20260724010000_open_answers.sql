-- Fase 1-3 de correccion IA de preguntas de desarrollo (ver
-- docs/plan-correccion-ia-abiertas.md). Migracion ADITIVA.
--
-- quizzes.open_question_rubrics: JSON-string por pregunta abierta,
--   {"<pregunta>": {"rubric": "...", "max_points": N, "subtipo": "simple"|
--   "par_ordenado"|"entero_decimal"}}. NULL/'' = sin rubrica cargada (la
--   pregunta sigue quedando fuera del puntaje automatico, igual que hoy).
--   Parseo en src/lib/quiz_constraints.ts.
--
-- open_answers: un registro por (paper, pregunta abierta) capturado del
--   reverso escaneado, con la sugerencia de la IA. `confirmed_points` queda
--   NULL hasta que el profesor confirma/ajusta -- nunca se usa el puntaje de
--   la IA sin confirmar (principio del plan: "la IA sugiere, el profesor
--   decide"). `image_url` como data URL en columna TEXT, mismo patron que
--   papers.image_url/name_img_url (sin bucket de Storage nuevo).

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS open_question_rubrics TEXT;

CREATE TABLE IF NOT EXISTS open_answers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) NOT NULL,
    paper_id UUID REFERENCES papers(id) ON DELETE CASCADE NOT NULL,
    question INT NOT NULL,
    image_url TEXT,
    subtipo TEXT,
    transcripcion TEXT,
    puntaje NUMERIC,
    max_points NUMERIC,
    justificacion TEXT,
    confianza TEXT,
    legible BOOLEAN,
    model TEXT,
    confirmed_points NUMERIC,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (paper_id, question)
);

CREATE INDEX IF NOT EXISTS idx_open_answers_school ON open_answers(school_id);
CREATE INDEX IF NOT EXISTS idx_open_answers_paper ON open_answers(paper_id);

ALTER TABLE open_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_open_answers" ON open_answers FOR ALL USING (
    school_id IN (SELECT school_id FROM school_members WHERE user_id = auth.uid())
);

NOTIFY pgrst, 'reload schema';
