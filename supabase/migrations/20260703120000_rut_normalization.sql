-- Normalización canónica de RUT para unir alumnos y lecturas sin depender del formato.
-- Aplicación: ejecutar esta migración en Supabase antes de desplegar el código que usa
-- students.rut_normalized y papers.student_rut_norm.
-- No toca el motor OMR ni modifica los códigos crudos guardados en papers.student_id.

CREATE OR REPLACE FUNCTION public.tulector_canonical_rut(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  compact text;
  body text;
  dv text;
  expected text;
  expected_number integer;
  idx integer;
  multiplier integer := 2;
  total integer := 0;
BEGIN
  IF input IS NULL THEN
    RETURN NULL;
  END IF;

  compact := upper(regexp_replace(input, '[\.\s-]', '', 'g'));
  IF compact !~ '^[0-9]{7,8}[0-9K]$' THEN
    RETURN NULL;
  END IF;

  body := substring(compact from 1 for char_length(compact) - 1);
  dv := substring(compact from char_length(compact) for 1);

  FOR idx IN REVERSE char_length(body)..1 LOOP
    total := total + substring(body from idx for 1)::integer * multiplier;
    multiplier := CASE WHEN multiplier = 7 THEN 2 ELSE multiplier + 1 END;
  END LOOP;

  expected_number := 11 - (total % 11);
  expected := CASE
    WHEN expected_number = 11 THEN '0'
    WHEN expected_number = 10 THEN 'K'
    ELSE expected_number::text
  END;

  IF expected <> dv THEN
    RETURN NULL;
  END IF;

  RETURN body || dv;
END;
$$;

ALTER TABLE students ADD COLUMN IF NOT EXISTS rut_normalized text;
ALTER TABLE papers ADD COLUMN IF NOT EXISTS student_rut_norm text;

-- Backfill alumnos: preferimos students.rut; si falta, intentamos student_id.
UPDATE students
SET rut_normalized = COALESCE(public.tulector_canonical_rut(rut), public.tulector_canonical_rut(student_id))
WHERE rut_normalized IS DISTINCT FROM COALESCE(public.tulector_canonical_rut(rut), public.tulector_canonical_rut(student_id));

-- Backfill lecturas: student_id queda como código crudo, student_rut_norm guarda la llave canónica.
UPDATE papers
SET student_rut_norm = public.tulector_canonical_rut(student_id)
WHERE student_rut_norm IS DISTINCT FROM public.tulector_canonical_rut(student_id);

CREATE INDEX IF NOT EXISTS idx_students_school_rut_normalized
  ON students (school_id, rut_normalized)
  WHERE rut_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_papers_school_student_rut_norm
  ON papers (school_id, student_rut_norm)
  WHERE student_rut_norm IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_papers_school_quiz_student_rut_norm
  ON papers (school_id, quiz_id, student_rut_norm)
  WHERE student_rut_norm IS NOT NULL;
