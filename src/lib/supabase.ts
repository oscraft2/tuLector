import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseKey);
}

// Tipos de la base de datos
export type Quiz = {
  id: string;
  user_id: string;
  title: string;
  num_questions: number;
  options_per_question: number;
  option_labels: string;
  answer_key: string;
  created_at: string;
  updated_at: string;
};

export type Paper = {
  id: string;
  quiz_id: string;
  user_id: string;
  student_id: string | null;
  student_name: string | null;
  score: number | null;
  total: number | null;
  answers: number[][];
  raw_scores: number[][];
  image_url: string | null;
  scanned_at: string;
};

export type Student = {
  id: string;
  user_id: string;
  student_id: string;
  name: string;
  created_at: string;
};

// Funciones CRUD para quizzes
export async function createQuiz(client: ReturnType<typeof createClient>, quiz: { title: string; answerKey: string; numQuestions?: number }) {
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("No autenticado");

  return client.from("quizzes").insert({
    user_id: user.id,
    title: quiz.title,
    answer_key: quiz.answerKey,
    num_questions: quiz.numQuestions || 20,
  }).select().single();
}

export async function getQuizzes(client: ReturnType<typeof createClient>) {
  return client.from("quizzes").select("*").order("created_at", { ascending: false });
}

// Funciones CRUD para papers
export async function savePaper(client: ReturnType<typeof createClient>, paper: {
  quizId: string;
  studentId?: string;
  studentName?: string;
  score: number;
  total: number;
  answers: string[];
  rawScores: number[][];
  imageUrl?: string;
}) {
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("No autenticado");

  return client.from("papers").insert({
    user_id: user.id,
    quiz_id: paper.quizId,
    student_id: paper.studentId || null,
    student_name: paper.studentName || null,
    score: paper.score,
    total: paper.total,
    answers: paper.answers,
    raw_scores: paper.rawScores,
    image_url: paper.imageUrl || null,
  }).select().single();
}

export async function getPapers(client: ReturnType<typeof createClient>, quizId: string) {
  return client.from("papers").select("*").eq("quiz_id", quizId).order("scanned_at", { ascending: false });
}
