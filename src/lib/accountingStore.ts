import { supabase } from "./supabase";
import type { AnalyticalRow, SyntheticRow } from "./types";
import { normalizeContaForCompare } from "./accounting";

type AccessScope = { userId: string; role: "user" | "admin"; filterSetor?: string; filterUserId?: string };

export type UploadBatch = {
  id: string;
  fileName: string;
  syntheticRowsCount: number;
  analyticRowsCount: number;
  inconsistenciesCount: number;
  createdAt: string;
};

async function fetchAllPages<T>(build: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>) {
  const pageSize = 1000;
  let from = 0;
  const all: T[] = [];
  for (let i = 0; i < 1000; i += 1) {
    const to = from + pageSize - 1;
    const { data, error } = await build(from, to);
    if (error) throw error;
    const chunk = data ?? [];
    all.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export async function insertBatchWithRecords(params: {
  userId: string;
  setor: string;
  fileName: string;
  syntheticRows: SyntheticRow[];
  analyticalRows: AnalyticalRow[];
  inconsistenciesCount: number;
}) {
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data: batch, error: batchError } = await supabase
    .from("accounting_upload_batches")
    .insert({
      user_id: params.userId,
      profile_id: params.userId,
      setor: params.setor,
      file_name: params.fileName,
      synthetic_rows_count: params.syntheticRows.length,
      analytic_rows_count: params.analyticalRows.length,
      inconsistencies_count: params.inconsistenciesCount,
    })
    .select("id")
    .single();

  if (batchError || !batch?.id) throw new Error(`Falha ao criar lote de upload: ${batchError?.message ?? "sem id"}`);

  const batchId = batch.id as string;

  const syntheticPayload = params.syntheticRows.map((row) => ({
    user_id: params.userId,
    profile_id: params.userId,
    setor: params.setor,
    conta: row.conta,
    descricao: row.descricao,
    total: row.total,
    grupo: row.grupo,
    mes: row.mes,
    uploaded_file_name: params.fileName,
    upload_batch_id: batchId,
  }));

  const analyticPayload = params.analyticalRows.map((row) => ({
    user_id: params.userId,
    profile_id: params.userId,
    setor: params.setor,
    conta: row.conta,
    descricao: row.descricao,
    valor: row.valor,
    forma: row.forma,
    mes: row.mes,
    uploaded_file_name: params.fileName,
    upload_batch_id: batchId,
  }));

  // Prevent duplicated inserts within the same upload batch.
  const uniqueSyntheticPayload = Array.from(
    new Map(
      syntheticPayload.map((r) => [
        `${r.user_id}::${r.setor}::${r.conta}::${r.descricao}::${r.total}::${r.grupo ?? ""}::${r.mes}::${r.upload_batch_id}`,
        r,
      ])
    ).values()
  );
  const uniqueAnalyticPayload = Array.from(
    new Map(
      analyticPayload.map((r) => [
        `${r.user_id}::${r.setor}::${r.conta}::${r.descricao}::${r.valor}::${r.forma ?? ""}::${r.mes}::${r.upload_batch_id}`,
        r,
      ])
    ).values()
  );

  const chunkSize = 1000;
  for (let i = 0; i < uniqueSyntheticPayload.length; i += chunkSize) {
    const { error } = await supabase
      .from("accounting_synthetic_records")
      .upsert(uniqueSyntheticPayload.slice(i, i + chunkSize), {
        onConflict: "user_id,setor,conta,descricao,total,grupo,mes",
        ignoreDuplicates: true,
      });
    if (error) throw new Error(`Falha ao persistir sintético: ${error.message}`);
  }

  for (let i = 0; i < uniqueAnalyticPayload.length; i += chunkSize) {
    const { error } = await supabase
      .from("accounting_analytic_records")
      .upsert(uniqueAnalyticPayload.slice(i, i + chunkSize), {
        onConflict: "user_id,setor,conta,descricao,valor,forma,mes",
        ignoreDuplicates: true,
      });
    if (error) throw new Error(`Falha ao persistir analítico: ${error.message}`);
  }

  return batchId;
}

export async function fetchSyntheticRecords(scope: AccessScope): Promise<Array<SyntheticRow & { setor?: string; userId?: string; uploadBatchId?: string }>> {
  if (!supabase) return [];
  const client = supabase;
  const data = await fetchAllPages<any>(async (from, to) => {
    let query = client
      .from("accounting_synthetic_records")
      .select("conta, descricao, total, grupo, mes, user_id, setor, upload_batch_id")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (scope.role === "user") query = query.eq("user_id", scope.userId);
    if (scope.role === "admin" && scope.filterSetor && scope.filterSetor !== "todos") query = query.eq("setor", scope.filterSetor);
    if (scope.role === "admin" && scope.filterUserId && scope.filterUserId !== "todos") query = query.eq("user_id", scope.filterUserId);
    return await query;
  }).catch((error: any) => {
    throw new Error(`Falha ao carregar sintético: ${error.message}`);
  });

  return data.map((row) => ({
    conta: String((row as any).conta ?? ""),
    descricao: String((row as any).descricao ?? "Sem descrição"),
    total: Number((row as any).total ?? 0),
    grupo: String((row as any).grupo ?? "Não informado"),
    mes: String((row as any).mes ?? ""),
    setor: String((row as any).setor ?? ""),
    userId: String((row as any).user_id ?? ""),
    uploadBatchId: String((row as any).upload_batch_id ?? ""),
  }));
}

export async function fetchAnalyticalRecords(scope: AccessScope): Promise<Array<AnalyticalRow & { setor?: string; userId?: string; uploadBatchId?: string; recordId?: string }>> {
  if (!supabase) return [];
  const client = supabase;
  const data = await fetchAllPages<any>(async (from, to) => {
    let query = client
      .from("accounting_analytic_records")
      .select("id, conta, descricao, valor, forma, mes, user_id, setor, upload_batch_id")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (scope.role === "user") query = query.eq("user_id", scope.userId);
    if (scope.role === "admin" && scope.filterSetor && scope.filterSetor !== "todos") query = query.eq("setor", scope.filterSetor);
    if (scope.role === "admin" && scope.filterUserId && scope.filterUserId !== "todos") query = query.eq("user_id", scope.filterUserId);
    return await query;
  }).catch((error: any) => {
    throw new Error(`Falha ao carregar analítico: ${error.message}`);
  });

  return data.map((row) => ({
    recordId: String((row as any).id ?? ""),
    conta: String((row as any).conta ?? ""),
    descricao: String((row as any).descricao ?? "Sem descrição"),
    valor: Number((row as any).valor ?? 0),
    forma: String((row as any).forma ?? "Não informado"),
    mes: String((row as any).mes ?? ""),
    setor: String((row as any).setor ?? ""),
    userId: String((row as any).user_id ?? ""),
    uploadBatchId: String((row as any).upload_batch_id ?? ""),
  }));
}

function contaCandidates(rawConta: string) {
  const source = String(rawConta ?? "").trim();
  const normalized = normalizeContaForCompare(source);
  if (!normalized) return source ? [source] : [];
  const plain = normalized.toUpperCase();
  const bracketed = `[${plain}]`;
  return Array.from(new Set([source, plain, bracketed]));
}

export async function fetchAnalyticalLinkedRecords(params: {
  scope: AccessScope;
  conta: string;
  descricao?: string;
  mes?: string;
  batch?: string;
  linkedUserId?: string;
  linkedSetor?: string;
}): Promise<Array<AnalyticalRow & { setor?: string; userId?: string; uploadBatchId?: string; recordId?: string }>> {
  if (!supabase) return [];
  const client = supabase;
  const contaValues = contaCandidates(params.conta);
  if (!contaValues.length) return [];

  const data = await fetchAllPages<any>(async (from, to) => {
    let query = client
      .from("accounting_analytic_records")
      .select("id, conta, descricao, valor, forma, mes, user_id, setor, upload_batch_id")
      .in("conta", contaValues)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (params.mes && params.mes !== "todos") query = query.eq("mes", params.mes);
    if (params.batch) query = query.eq("upload_batch_id", params.batch);
    if (params.descricao) query = query.ilike("descricao", `%${params.descricao}%`);
    if (params.scope.role === "user") query = query.eq("user_id", params.scope.userId);
    if (params.scope.role === "admin" && params.scope.filterSetor && params.scope.filterSetor !== "todos") query = query.eq("setor", params.scope.filterSetor);
    if (params.scope.role === "admin" && params.scope.filterUserId && params.scope.filterUserId !== "todos") query = query.eq("user_id", params.scope.filterUserId);
    if (params.scope.role === "admin" && params.linkedSetor) query = query.eq("setor", params.linkedSetor);
    if (params.scope.role === "admin" && params.linkedUserId) query = query.eq("user_id", params.linkedUserId);
    return await query;
  }).catch((error: any) => {
    throw new Error(`Falha ao carregar analítico vinculado: ${error.message}`);
  });

  return (data ?? []).map((row) => ({
    recordId: String((row as any).id ?? ""),
    conta: String((row as any).conta ?? ""),
    descricao: String((row as any).descricao ?? "Sem descrição"),
    valor: Number((row as any).valor ?? 0),
    forma: String((row as any).forma ?? "Não informado"),
    mes: String((row as any).mes ?? ""),
    setor: String((row as any).setor ?? ""),
    userId: String((row as any).user_id ?? ""),
    uploadBatchId: String((row as any).upload_batch_id ?? ""),
  }));
}

export async function fetchUploadBatches(scope: AccessScope): Promise<UploadBatch[]> {
  if (!supabase) return [];
  const client = supabase;
  const data = await fetchAllPages<any>(async (from, to) => {
    let query = client
      .from("accounting_upload_batches")
      .select("id, file_name, synthetic_rows_count, analytic_rows_count, inconsistencies_count, created_at, user_id, setor")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (scope.role === "user") query = query.eq("user_id", scope.userId);
    if (scope.role === "admin" && scope.filterSetor && scope.filterSetor !== "todos") query = query.eq("setor", scope.filterSetor);
    if (scope.role === "admin" && scope.filterUserId && scope.filterUserId !== "todos") query = query.eq("user_id", scope.filterUserId);
    return await query;
  }).catch((error: any) => {
    throw new Error(`Falha ao carregar lotes: ${error.message}`);
  });

  return data.map((r) => ({
    id: String((r as any).id),
    fileName: String((r as any).file_name),
    syntheticRowsCount: Number((r as any).synthetic_rows_count ?? 0),
    analyticRowsCount: Number((r as any).analytic_rows_count ?? 0),
    inconsistenciesCount: Number((r as any).inconsistencies_count ?? 0),
    createdAt: String((r as any).created_at ?? ""),
  }));
}

export async function fetchUsersForAdmin() {
  if (!supabase) return [] as Array<{ id: string; full_name: string; email: string }>;
  const { data, error } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
  if (error) return [];
  return data ?? [];
}

