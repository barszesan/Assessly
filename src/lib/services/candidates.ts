import type { SupabaseClient } from "@supabase/supabase-js";
import type { Candidate } from "@/types";

export interface CreateCandidateInput {
  position_id: string;
  file_name: string;
  file_path: string;
  extracted_text: string;
}

export async function listCandidates(supabase: SupabaseClient, positionId: string): Promise<Candidate[]> {
  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .eq("position_id", positionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as Candidate[];
}

export async function createCandidate(supabase: SupabaseClient, input: CreateCandidateInput): Promise<Candidate> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data, error } = await supabase
    .from("candidates")
    .insert({
      position_id: input.position_id,
      file_name: input.file_name,
      file_path: input.file_path,
      extracted_text: input.extracted_text,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Candidate;
}

export async function createCandidatesBatch(
  supabase: SupabaseClient,
  inputs: CreateCandidateInput[],
): Promise<Candidate[]> {
  if (inputs.length === 0) return [];

  const { data, error } = await supabase
    .from("candidates")
    .insert(
      inputs.map((i) => ({
        position_id: i.position_id,
        file_name: i.file_name,
        file_path: i.file_path,
        extracted_text: i.extracted_text,
      })),
    )
    .select();

  if (error) throw error;
  return data as Candidate[];
}

export async function getCandidate(supabase: SupabaseClient, candidateId: string): Promise<Candidate | null> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data, error } = await supabase.from("candidates").select("*").eq("id", candidateId).single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as Candidate;
}

export async function deleteCandidate(
  supabase: SupabaseClient,
  candidateId: string,
): Promise<{ filePath: string } | null> {
  const existing = await getCandidate(supabase, candidateId);
  if (!existing) return null;

  const { error } = await supabase.from("candidates").delete().eq("id", candidateId);
  if (error) throw error;

  return { filePath: existing.file_path };
}

export async function countCandidates(supabase: SupabaseClient, positionId: string): Promise<number> {
  const { count, error } = await supabase
    .from("candidates")
    .select("*", { count: "exact", head: true })
    .eq("position_id", positionId);

  if (error) throw error;
  return count ?? 0;
}
