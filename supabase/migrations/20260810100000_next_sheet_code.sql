-- Arregla "Hubo mucha actividad creando ensayos al mismo tiempo" para docentes
-- que NO son admin del colegio.
--
-- Causa: 20260808000000_teacher_isolation.sql dejo la policy "school_quizzes"
-- como (created_by = auth.uid() OR is_school_admin(school_id)). Desde entonces
-- un docente no-admin solo VE sus propios ensayos. La app calculaba el
-- siguiente sheet_code asi:
--
--   SELECT sheet_code FROM quizzes WHERE school_id = ? ORDER BY sheet_code DESC LIMIT 1
--
-- y RLS recortaba ese maximo a los ensayos del propio docente. Resultado: pedia
-- un codigo que otro usuario del MISMO colegio ya tenia, el INSERT violaba el
-- indice unico quizzes_school_sheet_code_uk (school_id, sheet_code) y el
-- reintento releia el mismo maximo equivocado -- se quedaba pegado en el mismo
-- numero hasta agotar los intentos y mostraba ese mensaje enganoso.
--
-- Un docente que es admin nunca lo vio (is_school_admin le deja ver todo), por
-- eso parecia intermitente.
--
-- Solucion: calcular el correlativo en una funcion SECURITY DEFINER, que lee la
-- tabla sin el filtro de RLS. No expone datos: recibe un colegio y devuelve un
-- entero, y ademas exige ser miembro de ese colegio.
--
-- Aplicar a mano en Supabase -> SQL Editor o `supabase db push`
-- (Vercel no corre migraciones).

CREATE OR REPLACE FUNCTION public.next_sheet_code(p_school uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next int;
BEGIN
  -- SECURITY DEFINER salta RLS, asi que el permiso se comprueba a mano: solo un
  -- miembro del colegio puede pedir el correlativo de ese colegio.
  IF NOT is_school_member(p_school) THEN
    RAISE EXCEPTION 'No autorizado para este colegio';
  END IF;

  -- Reduce (no elimina) la carrera entre dos docentes creando a la vez: el lock
  -- es de transaccion y esta funcion se ejecuta en la suya, asi que se libera
  -- ANTES del INSERT que hace la app. El reintento del lado de la app sigue
  -- siendo la garantia final -- pero ahora funciona, porque al releer obtiene
  -- el maximo REAL del colegio y no el suyo propio.
  PERFORM pg_advisory_xact_lock(hashtext('tulector:sheet_code:' || p_school::text));

  SELECT COALESCE(MAX(sheet_code), 0) + 1 INTO v_next
  FROM quizzes
  WHERE school_id = p_school;

  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.next_sheet_code(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_sheet_code(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
