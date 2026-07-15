-- Cierra el gap encontrado en el plan multi-pais (ver docs/plan-multipais-motor.md):
-- la tabla `countries` (20260525000001_latam.sql) nunca tuvo fila para Brasil
-- aunque el motor OMR ya lee CPF desde Fase 0 — y `schools.country_code`
-- REFERENCIA countries(code), asi que sin esta fila es IMPOSIBLE poner un
-- colegio en Brasil (falla el FK). Ademas corrige varios id_format_regex que
-- quedaron NULL en la migracion original, alineandolos con los algoritmos ya
-- implementados y probados en el motor (src/tulector/omr.ts + sheet_layout.ts)
-- y con COUNTRY_ID_FORMATS en src/lib/national_id.ts.
--
-- Aditivo/idempotente (ON CONFLICT DO UPDATE, mismo patron que la migracion
-- original). Aplicar a mano en Supabase -> SQL Editor o `supabase db push`
-- (Vercel no corre migraciones). Despues: NOTIFY pgrst, 'reload schema';

INSERT INTO countries (code, name, grade_scale_min, grade_scale_max, passing_grade, id_type, id_format_regex) VALUES
    ('BR', 'Brasil', 0, 10, 6, 'cpf', '^[0-9]{9}-[0-9]{2}$')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    grade_scale_min = EXCLUDED.grade_scale_min,
    grade_scale_max = EXCLUDED.grade_scale_max,
    passing_grade = EXCLUDED.passing_grade,
    id_type = EXCLUDED.id_type,
    id_format_regex = EXCLUDED.id_format_regex;

-- Regex NULL -> formato real (motor ya los valida y lee correctamente).
UPDATE countries SET id_type = 'cc', id_format_regex = '^[0-9]{6,10}$' WHERE code = 'CO';
UPDATE countries SET id_type = 'cedula', id_format_regex = '^[0-9]{10}$' WHERE code = 'EC';
UPDATE countries SET id_type = 'ci', id_format_regex = '^[0-9]{7,8}-[0-9]$' WHERE code = 'UY';
UPDATE countries SET id_format_regex = '^[0-9]{8}$' WHERE code = 'PE' AND id_format_regex IS NULL;

NOTIFY pgrst, 'reload schema';
