import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseKey);
}

export type School = {
  id: string; name: string; subdomain: string | null;
  plan: "starter" | "pro" | "school" | "district";
  scans_limit: number; scans_used: number; created_at: string;
};

export type Quiz = {
  id: string; school_id: string; user_id: string;
  title: string; num_questions: number; answer_key: string;
  subject: string | null; grade: string | null;
  created_at: string; updated_at: string;
};

export type Paper = {
  id: string; school_id: string; quiz_id: string; user_id: string;
  student_id: string | null; student_name: string | null;
  score: number | null; total: number | null;
  answers: string[]; raw_scores: number[][];
  image_url: string | null; scanned_at: string;
};

export type Student = {
  id: string; school_id: string; user_id: string;
  student_id: string; name: string; grade: string | null;
  created_at: string;
};

// Operaciones tipadas
export async function getPapers(client: ReturnType<typeof createClient>, quizId: string) {
  return client.from("papers").select("*").eq("quiz_id", quizId).order("scanned_at", { ascending: false });
}

export async function getQuizzes(client: ReturnType<typeof createClient>) {
  return client.from("quizzes").select("*").order("created_at", { ascending: false });
}

export async function getStudents(client: ReturnType<typeof createClient>) {
  return client.from("students").select("*").order("name");
}

export async function getSchool(client: ReturnType<typeof createClient>) {
  return client.from("schools").select("*").single();
}
