import type { SupabaseClient } from "@supabase/supabase-js";
import type { Position } from "@/types";
import type { CreatePositionInput, UpdatePositionInput } from "@/lib/schemas/position";

export async function listPositions(supabase: SupabaseClient): Promise<Position[]> {
  const { data, error } = await supabase.from("positions").select("*").order("created_at", { ascending: false });

  if (error) throw error;
  return data as Position[];
}

export async function getPosition(supabase: SupabaseClient, id: string): Promise<Position | null> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data, error } = await supabase.from("positions").select("*").eq("id", id).single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as Position;
}

export async function createPosition(
  supabase: SupabaseClient,
  input: CreatePositionInput,
  userId: string,
): Promise<Position> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data, error } = await supabase
    .from("positions")
    .insert({
      user_id: userId,
      title: input.title,
      description: input.description ?? null,
      seniority: input.seniority,
      team: input.team ?? null,
      requirements: input.requirements,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Position;
}

export async function updatePosition(
  supabase: SupabaseClient,
  id: string,
  input: UpdatePositionInput,
): Promise<Position | null> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data, error } = await supabase.from("positions").update(input).eq("id", id).select().single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as Position;
}

export async function deletePosition(supabase: SupabaseClient, id: string): Promise<boolean> {
  const { error, count } = await supabase.from("positions").delete({ count: "exact" }).eq("id", id);

  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function positionHasEvaluation(supabase: SupabaseClient, id: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("evaluations")
    .select("*", { count: "exact", head: true })
    .eq("position_id", id);

  if (error) throw error;
  return (count ?? 0) > 0;
}
