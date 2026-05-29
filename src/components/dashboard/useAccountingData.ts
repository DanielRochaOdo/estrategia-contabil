import { useEffect, useMemo, useState } from "react";
import type { Profile } from "../../lib/auth";
import type { AnalyticalRow, SyntheticRow } from "../../lib/types";
import { calculateInconsistencies, parseXlsxTwoSheets } from "../../lib/accounting";
import { fetchAnalyticalRecords, fetchSyntheticRecords, fetchUploadBatches, fetchUsersForAdmin, insertBatchWithRecords, type UploadBatch } from "../../lib/accountingStore";
import { registerUploadLog } from "../../lib/uploadLogs";

export function useAccountingData(profile: Profile) {
  const [syntheticRows, setSyntheticRows] = useState<Array<SyntheticRow & { setor?: string; userId?: string; uploadBatchId?: string }>>([]);
  const [analyticalRows, setAnalyticalRows] = useState<Array<AnalyticalRow & { setor?: string; userId?: string; uploadBatchId?: string }>>([]);
  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [lastUploadSummary, setLastUploadSummary] = useState<UploadBatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminSetor, setAdminSetor] = useState("todos");
  const [adminUser, setAdminUser] = useState("todos");
  const [users, setUsers] = useState<Array<{ id: string; full_name: string; email: string }>>([]);

  const refresh = async (setor = adminSetor, userId = adminUser) => {
    const scope = { userId: profile.id, role: profile.role, filterSetor: setor, filterUserId: userId } as const;
    const [sRows, aRows, bt] = await Promise.all([
      fetchSyntheticRecords(scope),
      fetchAnalyticalRecords(scope),
      fetchUploadBatches(scope),
    ]);
    setSyntheticRows(sRows);
    setAnalyticalRows(aRows);
    setBatches(bt);
  };

  useEffect(() => { void refresh(); }, []);
  useEffect(() => { if (profile.role === "admin") void refresh(adminSetor, adminUser); }, [adminSetor, adminUser]);

  useEffect(() => {
    if (profile.role === "admin") {
      void fetchUsersForAdmin().then(setUsers);
    }
  }, [profile.role]);

  const upload = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const parsed = await parseXlsxTwoSheets(file);
      const inconsistencies = calculateInconsistencies(parsed.syntheticRows, parsed.analyticalRows).filter((x) => x.status !== "OK");
      const batchId = await insertBatchWithRecords({
        userId: profile.id,
        setor: profile.setor,
        fileName: file.name,
        syntheticRows: parsed.syntheticRows,
        analyticalRows: parsed.analyticalRows,
        inconsistenciesCount: inconsistencies.length,
      });
      await refresh();
      const latest = {
        id: batchId,
        fileName: file.name,
        syntheticRowsCount: parsed.syntheticRows.length,
        analyticRowsCount: parsed.analyticalRows.length,
        inconsistenciesCount: inconsistencies.length,
        createdAt: new Date().toISOString(),
      } as UploadBatch;
      setLastUploadSummary(latest);

      const contasUnicas = new Set(parsed.analyticalRows.map((row) => row.conta)).size;
      const valorTotal = parsed.analyticalRows.reduce((sum, row) => sum + row.valor, 0);
      void registerUploadLog({ fileName: file.name, totalRows: parsed.analyticalRows.length, totalContas: contasUnicas, totalCompetencias: parsed.months.length, totalGrupos: parsed.groups.length, valorTotal, status: "success" });
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      void registerUploadLog({ fileName: file.name, totalRows: 0, totalContas: 0, totalCompetencias: 0, totalGrupos: 0, valorTotal: 0, status: "error", errorMessage: message });
    } finally {
      setLoading(false);
    }
  };

  const months = useMemo(() => Array.from(new Set([...syntheticRows.map((r) => r.mes), ...analyticalRows.map((r) => r.mes)])).sort(), [syntheticRows, analyticalRows]);
  const groups = useMemo(() => Array.from(new Set(syntheticRows.map((r) => r.grupo))).sort((a, b) => a.localeCompare(b)), [syntheticRows]);
  const forms = useMemo(() => Array.from(new Set(analyticalRows.map((r) => r.forma))).sort((a, b) => a.localeCompare(b)), [analyticalRows]);

  return { syntheticRows, analyticalRows, batches, lastUploadSummary, loading, error, months, groups, forms, upload, refresh, adminSetor, setAdminSetor, adminUser, setAdminUser, users };
}
