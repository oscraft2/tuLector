-- Compartir un ensayo con otros docentes del MISMO colegio (plan school).
--
-- Problema: 20260808000000_teacher_isolation.sql aisla a cada docente
-- (`created_by = auth.uid() OR is_school_admin(...)`). Si la profesora A crea un
-- ensayo e imprime sus hojas, el profesor B no lo ve en /dashboard/quizzes ni en
-- /app/scan, y su unica salida es crear/duplicar uno propio -- que recibe OTRO
-- sheet_code (indice unico quizzes_school_sheet_code_uk), asi que las hojas ya
-- impresas por A caen en manual_review al escanearlas B. Resultado: dos ensayos
-- paralelos y la base de resultados partida en dos.
--
-- Solucion: una tabla de comparticiones con aceptacion explicita y policies
-- NUEVAS que se SUMAN (OR) a las de teacher_isolation. El aislamiento por
-- defecto NO se toca: sin una fila `accepted` en quiz_shares nada cambia para
-- nadie. Con ella, el invitado ve el ensayo y puede escanear hojas que quedan en
-- el MISMO quiz_id -- que es justamente el punto: no se crea un ensayo nuevo.
--
-- Permiso unico "ver + escanear": el invitado NO edita pauta, puntajes ni
-- archiva (por eso `quizzes` le queda en SELECT y no en FOR ALL). Comparte el
-- dueño del ensayo o el admin del colegio.
--
-- Aplicar a mano en Supabase -> SQL Editor o `supabase db push`
-- (Vercel no corre migraciones). Despues: NOTIFY pgrst, 'reload schema';

CREATE TABLE IF NOT EXISTS quiz_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  shared_by UUID REFERENCES auth.users(id),
  shared_with UUID REFERENCES auth.users(id) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

-- Una sola compartición VIVA por (ensayo, docente). Las rechazadas y revocadas
-- quedan en la tabla como historial y no bloquean volver a compartir.
CREATE UNIQUE INDEX IF NOT EXISTS quiz_shares_live_uk
  ON quiz_shares(quiz_id, shared_with) WHERE status IN ('pending', 'accepted');
CREATE INDEX IF NOT EXISTS quiz_shares_recipient_idx ON quiz_shares(shared_with, status);
CREATE INDEX IF NOT EXISTS quiz_shares_quiz_idx ON quiz_shares(quiz_id);

ALTER TABLE quiz_shares ENABLE ROW LEVEL SECURITY;

-- ─── Helper ───────────────────────────────────────────────────────────────
-- SECURITY DEFINER es OBLIGATORIO, no una comodidad: las policies de quizzes y
-- papers llaman a esta funcion y las policies de quiz_shares miran quizzes. Sin
-- definer (o sea, leyendo quiz_shares con RLS puesta) Postgres entra en
-- recursion de policies y falla toda consulta. Igual que next_sheet_code
-- (20260810100000) e is_school_admin: recibe un id y devuelve un booleano, no
-- expone ninguna fila.
CREATE OR REPLACE FUNCTION public.has_quiz_share(p_quiz UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM quiz_shares
    WHERE quiz_id = p_quiz
      AND shared_with = auth.uid()
      AND status = 'accepted'
  );
$$;

REVOKE ALL ON FUNCTION public.has_quiz_share(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_quiz_share(UUID) TO authenticated;

-- ─── Policies de quiz_shares ──────────────────────────────────────────────
-- Ver: el que recibe, el que comparte y el admin del colegio.
DROP POLICY IF EXISTS "quiz_shares_read" ON quiz_shares;
CREATE POLICY "quiz_shares_read" ON quiz_shares FOR SELECT USING (
  shared_with = auth.uid() OR shared_by = auth.uid() OR is_school_admin(school_id)
);

-- Compartir: solo el DUEÑO del ensayo o el admin. El EXISTS sobre quizzes corre
-- con la RLS del que consulta, y eso basta: el dueño ve su ensayo por
-- teacher_isolation y el admin por is_school_admin.
DROP POLICY IF EXISTS "quiz_shares_insert" ON quiz_shares;
CREATE POLICY "quiz_shares_insert" ON quiz_shares FOR INSERT WITH CHECK (
  is_school_member(school_id) AND (
    is_school_admin(school_id) OR
    EXISTS (SELECT 1 FROM quizzes q WHERE q.id = quiz_shares.quiz_id AND q.created_by = auth.uid())
  )
);

-- Aceptar/rechazar (el invitado) y revocar (dueño o admin). Que transiciones de
-- `status` son validas se valida en los server actions
-- (src/app/dashboard/quizzes/actions.ts), no aca: una policy no puede comparar
-- el valor viejo con el nuevo sin un trigger, y el server action es el unico
-- camino de escritura de la app.
DROP POLICY IF EXISTS "quiz_shares_update" ON quiz_shares;
CREATE POLICY "quiz_shares_update" ON quiz_shares FOR UPDATE USING (
  shared_with = auth.uid() OR shared_by = auth.uid() OR is_school_admin(school_id)
) WITH CHECK (
  shared_with = auth.uid() OR shared_by = auth.uid() OR is_school_admin(school_id)
);

-- ─── Acceso al ensayo compartido ──────────────────────────────────────────
-- Todas estas policies son NUEVAS y permisivas: se combinan con OR contra las
-- de teacher_isolation, que quedan intactas.

-- El ensayo en si: SOLO LECTURA. La pauta, los puntajes y el archivar siguen
-- siendo del dueño (o del admin) -- por eso no es FOR ALL.
DROP POLICY IF EXISTS "shared_quizzes_read" ON quizzes;
CREATE POLICY "shared_quizzes_read" ON quizzes FOR SELECT USING (has_quiz_share(id));

-- Las hojas SI son de escritura completa: el invitado escanea (INSERT desde
-- /api/scan/result), asigna alumno y corrige. Es el corazon de "se comparte la
-- base y no se crea un ensayo nuevo".
DROP POLICY IF EXISTS "shared_quiz_papers" ON papers;
CREATE POLICY "shared_quiz_papers" ON papers FOR ALL
  USING (has_quiz_share(quiz_id))
  WITH CHECK (has_quiz_share(quiz_id));

-- Libro de notas: el upsert de /api/scan/result corre con la sesion de quien
-- escanea, asi que necesita la misma apertura que papers.
DROP POLICY IF EXISTS "shared_quiz_grade_records" ON grade_records;
CREATE POLICY "shared_quiz_grade_records" ON grade_records FOR ALL
  USING (has_quiz_share(quiz_id))
  WITH CHECK (has_quiz_share(quiz_id));

-- Multipagina (20260716000000_paper_pages.sql): las paginas sueltas de una hoja
-- se insertan durante el mismo escaneo.
DROP POLICY IF EXISTS "shared_quiz_paper_pages" ON paper_pages;
CREATE POLICY "shared_quiz_paper_pages" ON paper_pages FOR ALL
  USING (has_quiz_share(quiz_id))
  WITH CHECK (has_quiz_share(quiz_id));

-- Preguntas de desarrollo (20260724010000_open_answers.sql): quien escanea el
-- reverso tambien confirma sus respuestas. Esta tabla NO tiene quiz_id -- cuelga
-- del paper, asi que el permiso se busca a traves de el. El EXISTS ve el paper
-- gracias a la policy de arriba (shared_quiz_papers), que ya esta activa cuando
-- se evalua esta.
DROP POLICY IF EXISTS "shared_quiz_open_answers" ON open_answers;
CREATE POLICY "shared_quiz_open_answers" ON open_answers FOR ALL
  USING (EXISTS (SELECT 1 FROM papers p WHERE p.id = open_answers.paper_id AND has_quiz_share(p.quiz_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM papers p WHERE p.id = open_answers.paper_id AND has_quiz_share(p.quiz_id)));

-- Metadata del instrumento (ejes, habilidades por pregunta): se LEE para ver el
-- analisis de items, pero la define el dueño del ensayo.
DROP POLICY IF EXISTS "shared_quiz_question_metadata" ON question_metadata;
CREATE POLICY "shared_quiz_question_metadata" ON question_metadata FOR SELECT
  USING (has_quiz_share(quiz_id));

-- ─── Notificaciones: el canal in-app estaba roto ──────────────────────────
-- 1. src/app/api/notifications/route.ts pide la columna `link` desde siempre y
--    la tabla (20260626010000_dashboard_platform.sql) nunca la tuvo: el GET
--    respondia 500 y el campanario se lo tragaba en su catch. Sin esto, avisar
--    "te compartieron un ensayo" con enlace no es posible.
-- 2. La policy exigia is_school_admin para ESCRIBIR, asi que un docente no-admin
--    no podia ni marcar como leida su propia notificacion (el PATCH del
--    campanario fallaba en silencio). Ahora puede escribir la suya propia; la
--    insercion para OTRO usuario sigue necesitando service role (es lo que hace
--    quota_alerts.ts y lo que hara shareQuiz).
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT;

DROP POLICY IF EXISTS "notifications_user" ON notifications;
CREATE POLICY "notifications_user" ON notifications FOR ALL
  USING (user_id = auth.uid() OR is_school_admin(school_id))
  WITH CHECK (user_id = auth.uid() OR is_school_admin(school_id));

NOTIFY pgrst, 'reload schema';
