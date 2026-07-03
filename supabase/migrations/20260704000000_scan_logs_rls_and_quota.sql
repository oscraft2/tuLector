-- Seguridad + cuota real (auditoría jul 2026, hallazgos #1 y #2).
--
-- (1) scan_logs guardaba fotos de hojas (RUT + nombre de menores) con RLS de
--     lectura PÚBLICA → se restringe SELECT a staff de plataforma e INSERT a
--     usuarios autenticados (el escáner corre con la sesión del profe, sigue
--     funcionando; el dataset offline requiere service role).
-- (2) scans_used nunca se incrementaba (cuota decorativa) → función atómica
--     SECURITY DEFINER que valida membresía; la llama /api/scan/result por RPC.
--     Cuerpo en comillas simples (sin $$) para sobrevivir al SQL Editor.

-- (1a) Lectura de scan_logs: solo staff de plataforma.
DROP POLICY IF EXISTS "public_select_logs" ON scan_logs;
DROP POLICY IF EXISTS "staff_select_logs" ON scan_logs;
CREATE POLICY "staff_select_logs" ON scan_logs FOR SELECT USING (is_platform_staff());

-- (1b) Escritura de scan_logs: solo autenticados (antes: cualquiera).
DROP POLICY IF EXISTS "public_insert_logs" ON scan_logs;
DROP POLICY IF EXISTS "auth_insert_logs" ON scan_logs;
CREATE POLICY "auth_insert_logs" ON scan_logs FOR INSERT TO authenticated WITH CHECK (true);

-- (2) Contador de cuota: +1 atómico, solo para miembros del colegio.
CREATE OR REPLACE FUNCTION increment_scans_used(p_school_id uuid)
RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public AS
'UPDATE schools
   SET scans_used = COALESCE(scans_used, 0) + 1
 WHERE id = p_school_id
   AND EXISTS (SELECT 1 FROM school_members WHERE school_id = p_school_id AND user_id = auth.uid())
 RETURNING scans_used';

REVOKE ALL ON FUNCTION increment_scans_used(uuid) FROM public;
GRANT EXECUTE ON FUNCTION increment_scans_used(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
