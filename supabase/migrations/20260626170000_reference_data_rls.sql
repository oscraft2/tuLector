-- Habilitar RLS en tablas de referencia
ALTER TABLE public.chile_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instituciones_superiores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simce_resultados ENABLE ROW LEVEL SECURITY;

-- Crear políticas de acceso de lectura pública para tablas de referencia
DROP POLICY IF EXISTS "Allow public read access to chile_schools" ON public.chile_schools;
CREATE POLICY "Allow public read access to chile_schools" ON public.chile_schools FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow public read access to comunas" ON public.comunas;
CREATE POLICY "Allow public read access to comunas" ON public.comunas FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow public read access to instituciones_superiores" ON public.instituciones_superiores;
CREATE POLICY "Allow public read access to instituciones_superiores" ON public.instituciones_superiores FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow public read access to simce_resultados" ON public.simce_resultados;
CREATE POLICY "Allow public read access to simce_resultados" ON public.simce_resultados FOR SELECT TO anon, authenticated USING (true);

-- Otorgar permisos SELECT explícitos
GRANT SELECT ON public.chile_schools TO anon, authenticated;
GRANT SELECT ON public.comunas TO anon, authenticated;
GRANT SELECT ON public.instituciones_superiores TO anon, authenticated;
GRANT SELECT ON public.simce_resultados TO anon, authenticated;

-- Otorgar permiso de ejecución para la función de búsqueda
GRANT EXECUTE ON FUNCTION public.buscar_escuelas(text, int) TO anon, authenticated;

-- ================================================================
-- POLÍTICAS DE RLS PARA EL PROCESO DE ONBOARDING (Crear escuela y miembros)
-- ================================================================

-- Permitir a usuarios autenticados crear (insertar) escuelas durante onboarding
DROP POLICY IF EXISTS "auth_insert_schools" ON public.schools;
CREATE POLICY "auth_insert_schools" ON public.schools 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Permitir a los administradores actualizar su propia escuela
DROP POLICY IF EXISTS "school_admins_update" ON public.schools;
CREATE POLICY "school_admins_update" ON public.schools 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.school_members sm 
    WHERE sm.user_id = auth.uid() 
    AND sm.role = 'admin' 
    AND sm.school_id = schools.id
  )
);

-- Permitir a usuarios autenticados crear el primer registro de membresía en una escuela (o si ya son administradores de la misma)
DROP POLICY IF EXISTS "auth_insert_school_members" ON public.school_members;
CREATE POLICY "auth_insert_school_members" ON public.school_members 
FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated' AND (
    user_id = auth.uid() AND (
      NOT EXISTS (SELECT 1 FROM public.school_members sm WHERE sm.school_id = school_members.school_id)
      OR EXISTS (SELECT 1 FROM public.school_members sm WHERE sm.user_id = auth.uid() AND sm.role = 'admin' AND sm.school_id = school_members.school_id)
    )
  )
);
