"use server";

import { createSupabaseServerClient } from "@/lib/supabase_server";

export async function faqVoteAction(articleId: string, helpful: boolean) {
  const supabase = createSupabaseServerClient();
  await supabase.rpc("faq_vote", { p_article_id: articleId, p_helpful: helpful });
}
