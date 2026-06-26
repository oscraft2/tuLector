-- Datos de referencia de Chile: colegios, comunas, regiones, SIMCE, instituciones superiores
-- Fuente: MINEDUC Directorio Oficial EE 2025 + Agencia de Calidad SIMCE + CNED

-- 1. Comunas y regiones
CREATE TABLE IF NOT EXISTS public.comunas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  comuna text NOT NULL,
  region_cod text NOT NULL,
  region_nombre text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(comuna, region_cod)
);
CREATE INDEX IF NOT EXISTS idx_comunas_region ON public.comunas (region_cod);
CREATE INDEX IF NOT EXISTS idx_comunas_nombre ON public.comunas (comuna);

-- 2. Colegios (directorio oficial MINEDUC)
CREATE TABLE IF NOT EXISTS public.chile_schools (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  rbd text NOT NULL,
  nombre text NOT NULL,
  comuna text DEFAULT '',
  region text DEFAULT '',
  dependencia text,
  rural boolean DEFAULT false,
  lat double precision,
  lng double precision,
  matricula_total int,
  estado text,
  convenio_pie boolean DEFAULT false,
  pace boolean DEFAULT false,
  pago_matricula text,
  pago_mensual text,
  orientacion_religiosa text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rbd)
);
CREATE INDEX IF NOT EXISTS idx_chile_schools_rbd ON public.chile_schools (rbd);
CREATE INDEX IF NOT EXISTS idx_chile_schools_comuna ON public.chile_schools (comuna);
CREATE INDEX IF NOT EXISTS idx_chile_schools_region ON public.chile_schools (region);
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_chile_schools_nombre_trgm ON public.chile_schools USING gin (nombre gin_trgm_ops);

-- Funcion de busqueda de colegios
CREATE OR REPLACE FUNCTION buscar_escuelas(
  search_term text DEFAULT NULL,
  limit_results int DEFAULT 20
)
RETURNS SETOF public.chile_schools
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.chile_schools
  WHERE
    (search_term IS NULL OR search_term = ''
     OR rbd = search_term
     OR nombre ILIKE '%' || search_term || '%'
     OR comuna ILIKE '%' || search_term || '%')
  ORDER BY
    CASE WHEN rbd = search_term THEN 0 ELSE 1 END,
    CASE WHEN nombre ILIKE search_term || '%' THEN 0 ELSE 1 END,
    nombre ASC
  LIMIT limit_results;
$$;

-- 3. Resultados SIMCE
CREATE TABLE IF NOT EXISTS public.simce_resultados (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  rbd text NOT NULL,
  agno int NOT NULL DEFAULT 2025,
  grado text NOT NULL,
  asignatura text NOT NULL,
  puntaje_promedio decimal(6,1),
  nivel_adecuado_pct decimal(5,1),
  nivel_elemental_pct decimal(5,1),
  nivel_insuficiente_pct decimal(5,1),
  alumnos_evaluados int,
  cod_reg_rbd int,
  nom_reg_rbd text,
  cod_com_rbd int,
  nom_com_rbd text,
  cod_depe int,
  grupo_socioeconomico text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rbd, agno, grado, asignatura)
);
CREATE INDEX IF NOT EXISTS idx_simce_rbd ON public.simce_resultados (rbd);
CREATE INDEX IF NOT EXISTS idx_simce_rbd_agno ON public.simce_resultados (rbd, agno);

-- Funcion resumen SIMCE por colegio
CREATE OR REPLACE FUNCTION simce_resumen(p_rbd text)
RETURNS TABLE(
  grado text,
  asignatura text,
  puntaje_promedio decimal(6,1),
  agno int
)
LANGUAGE sql
STABLE
AS $$
  SELECT grado, asignatura, puntaje_promedio, agno
  FROM public.simce_resultados
  WHERE rbd = p_rbd
  ORDER BY agno DESC, grado, asignatura;
$$;

-- 4. Instituciones de educacion superior (universidades, IP, CFT)
CREATE TABLE IF NOT EXISTS public.instituciones_superiores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL,
  sigla text,
  tipo text,
  acreditada boolean DEFAULT false,
  anios_acreditacion int,
  region text,
  comuna text,
  sitio_web text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(nombre)
);
CREATE INDEX IF NOT EXISTS idx_instituciones_superiores_nombre ON public.instituciones_superiores (nombre);
