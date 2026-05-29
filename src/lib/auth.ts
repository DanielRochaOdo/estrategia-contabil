import { supabase } from "./supabase";
import type { Setor } from "./constants";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  setor: Setor;
  role: "user" | "admin";
};

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signUp(params: { fullName: string; setor: Setor; email: string; password: string }) {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: { data: { full_name: params.fullName, setor: params.setor } },
  });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, setor, role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Profile | null;
}
