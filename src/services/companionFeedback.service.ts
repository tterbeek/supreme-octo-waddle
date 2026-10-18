import { supabase } from "../supabaseClient";
import { FEEDBACK_COMMENT_LIMIT, type CompanionFeedback, type CompanionFeedbackRating } from "../../supabase/functions/_shared/companionFeedback";
export type { CompanionFeedback, CompanionFeedbackRating } from "../../supabase/functions/_shared/companionFeedback";
export { FEEDBACK_COMMENT_LIMIT };

export async function fetchCompanionFeedback(postId: string, generatedAt: string): Promise<CompanionFeedback | null> {
  const { data, error } = await supabase.from("companion_feedback")
    .select("post_id, output_generated_at, rating, comment, updated_at")
    .eq("post_id", postId).eq("output_generated_at", generatedAt).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveCompanionFeedback(postId: string, generatedAt: string, rating: CompanionFeedbackRating, comment?: string): Promise<CompanionFeedback> {
  if (comment !== undefined && comment.trim().length > FEEDBACK_COMMENT_LIMIT) throw new Error("Please keep feedback within 300 characters.");
  const { data, error } = await supabase.rpc("save_companion_feedback", {
    p_post_id: postId, p_output_generated_at: generatedAt, p_rating: rating,
    p_save_comment: comment !== undefined, p_comment: comment === undefined ? null : comment.trim() || null,
  });
  if (error) throw error;
  return data as CompanionFeedback;
}

export async function removeCompanionFeedback(postId: string, generatedAt: string) {
  const { error } = await supabase.from("companion_feedback").delete()
    .eq("post_id", postId).eq("output_generated_at", generatedAt);
  if (error) throw error;
}
