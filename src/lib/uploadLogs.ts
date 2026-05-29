import { supabase } from "./supabase";

export type UploadLogInput = {
  fileName: string;
  totalRows: number;
  totalContas: number;
  totalCompetencias: number;
  totalGrupos: number;
  valorTotal: number;
  status: "success" | "error";
  errorMessage?: string;
};

export async function registerUploadLog(payload: UploadLogInput): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("upload_logs")
    .insert({
      file_name: payload.fileName,
      total_rows: payload.totalRows,
      total_accounts: payload.totalContas,
      total_competencias: payload.totalCompetencias,
      total_groups: payload.totalGrupos,
      total_value: payload.valorTotal,
      status: payload.status,
      error_message: payload.errorMessage ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Falha ao registrar upload no Supabase:", error.message);
    return null;
  }

  return data?.id ?? null;
}
