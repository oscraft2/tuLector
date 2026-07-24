import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";
import { gradeOpenAnswer } from "@/lib/ai_grade_open";
import { parseOpenQuestionRubrics } from "@/lib/quiz_constraints";
import { isMissingColumnError, isMissingTableError } from "@/lib/supabase_errors";

/**
 * Recibe recortes YA capturados del reverso (crop hecho client-side, ver
 * src/lib/open_answer_capture.ts -- mismo patrón que /api/scan/result: todo
 * el procesamiento de imagen es client-side, el servidor solo llama a la IA
 * (API key nunca sale al cliente) y persiste. Ver docs/plan-correccion-ia-
 * abiertas.md Fase 3.
 */
type CropInput = { question: number; imageDataUrl: string };

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { mimeType: m[1], base64: m[2] };
}

export async function POST(req: Request) {
  const { supabase, school } = await getDashboardContext();
  const payload = (await req.json().catch(() => null)) as { paperId?: string; crops?: CropInput[] } | null;
  if (!payload?.paperId || !Array.isArray(payload.crops) || payload.crops.length === 0) {
    return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
  }

  // El paper debe pertenecer a este colegio (RLS ya lo exige; validamos
  // explicito para dar un 404 claro y para traer el quiz_id).
  const { data: paper, error: paperError } = await supabase
    .from("papers")
    .select("id, quiz_id")
    .eq("id", payload.paperId)
    .eq("school_id", school.id)
    .single();
  if (paperError || !paper) return NextResponse.json({ error: "Hoja no encontrada" }, { status: 404 });

  let rubricsRaw: string | null = null;
  const quizResult = await supabase.from("quizzes").select("open_question_rubrics").eq("id", paper.quiz_id).maybeSingle();
  if (quizResult.error && !isMissingColumnError(quizResult.error, "open_question_rubrics")) {
    return NextResponse.json({ error: "No se pudo leer el ensayo" }, { status: 500 });
  }
  if (!quizResult.error) {
    rubricsRaw = (quizResult.data as { open_question_rubrics?: string | null } | null)?.open_question_rubrics ?? null;
  }
  const rubrics = parseOpenQuestionRubrics(rubricsRaw);

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const results: Array<{ question: number; ok: boolean; transcripcion?: string; puntaje?: number; maxPoints?: number; confianza?: string; legible?: boolean; error?: string }> = [];

  for (const crop of payload.crops) {
    const parsedUrl = crop?.imageDataUrl ? parseDataUrl(crop.imageDataUrl) : null;
    if (!parsedUrl || !Number.isInteger(crop.question)) {
      results.push({ question: crop?.question, ok: false, error: "recorte invalido" });
      continue;
    }
    const rubric = rubrics[crop.question];
    try {
      const graded = await gradeOpenAnswer({
        imageBase64: parsedUrl.base64,
        mimeType: parsedUrl.mimeType,
        enunciado: "", // tuLector no guarda el enunciado real (derechos del instrumento, ver dia-bot/docs/FINDINGS.md)
        rubric: rubric?.rubric ?? "",
        maxPoints: rubric?.max_points ?? 0,
        subtipo: rubric?.subtipo ?? "simple",
      });
      const { error: upsertError } = await supabase.from("open_answers").upsert(
        {
          school_id: school.id,
          paper_id: paper.id,
          question: crop.question,
          image_url: crop.imageDataUrl,
          subtipo: rubric?.subtipo ?? "simple",
          transcripcion: graded.transcripcion,
          puntaje: graded.puntaje,
          max_points: rubric?.max_points ?? 0,
          justificacion: graded.justificacion,
          confianza: graded.confianza,
          legible: graded.legible,
          model,
        },
        { onConflict: "paper_id,question" },
      );
      if (upsertError) {
        if (isMissingTableError(upsertError, "open_answers")) {
          return NextResponse.json({ error: "La base de datos no tiene la tabla open_answers todavia (falta aplicar la migracion)." }, { status: 500 });
        }
        throw upsertError;
      }
      results.push({
        question: crop.question, ok: true, transcripcion: graded.transcripcion,
        puntaje: graded.puntaje, maxPoints: rubric?.max_points ?? 0, confianza: graded.confianza, legible: graded.legible,
      });
    } catch (err) {
      results.push({ question: crop.question, ok: false, error: err instanceof Error ? err.message : "Error de la IA" });
    }
  }

  return NextResponse.json({ ok: true, results });
}
