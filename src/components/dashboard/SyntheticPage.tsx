import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CircleX, MessageCirclePlus } from "lucide-react";
import { Button, Card } from "../ui/primitives";
import { calculateInconsistencies, exportTemplateXlsx, exportViewToXlsx, formatBRL, normalizeContaForCompare } from "../../lib/accounting";
import type { Profile } from "../../lib/auth";
import { SETORES } from "../../lib/constants";
import { useAccountingData } from "./useAccountingData";

type ContaDelta = {
  mes: string;
  conta: string;
  contaNormalizada: string;
  descricao: string;
  atual: number;
  anterior: number;
  delta: number;
  userId?: string;
  setor?: string;
  uploadBatchId?: string;
};

type ImpactChartPoint = {
  mes: string;
  subidaConta: string;
  subidaDescricao: string;
  subida: number;
  quedaConta: string;
  quedaDescricao: string;
  queda: number;
};

type NovoAusenteItem = {
  mes: string;
  conta: string;
  contaNormalizada: string;
  descricao: string;
  total: number;
  userId?: string;
  setor?: string;
  uploadBatchId?: string;
};

type NovoAusenteChartPoint = {
  mes: string;
  novas: number;
  ausentes: number;
  novasItems: NovoAusenteItem[];
  ausentesItems: NovoAusenteItem[];
};

function buildContaDeltasForMonth(
  rows: Array<{ conta: string; descricao: string; mes: string; total: number; userId?: string; setor?: string; uploadBatchId?: string }>,
  month: string,
  previousMonth: string
): ContaDelta[] {
  const byContaCurrent = new Map<string, number>();
  const byContaPrevious = new Map<string, number>();
  const contaMeta = new Map<string, { conta: string; descricao: string; userId?: string; setor?: string; uploadBatchId?: string }>();

  for (const r of rows) {
    const normalized = normalizeContaForCompare(r.conta);
    if (!normalized) continue;

    const existingMeta = contaMeta.get(normalized);
    if (!existingMeta || (r.mes === month && r.descricao && existingMeta.descricao === "Sem descricao")) {
      contaMeta.set(normalized, {
        conta: r.conta,
        descricao: r.descricao || "Sem descricao",
        userId: r.userId,
        setor: r.setor,
        uploadBatchId: r.uploadBatchId,
      });
    }

    if (r.mes === month) byContaCurrent.set(normalized, (byContaCurrent.get(normalized) ?? 0) + r.total);
    if (r.mes === previousMonth) byContaPrevious.set(normalized, (byContaPrevious.get(normalized) ?? 0) + r.total);
  }

  const contas = new Set<string>([...byContaCurrent.keys(), ...byContaPrevious.keys()]);
  return [...contas].map((key) => {
    const atual = byContaCurrent.get(key) ?? 0;
    const anterior = byContaPrevious.get(key) ?? 0;
    const meta = contaMeta.get(key);
    return {
      mes: month,
      conta: meta?.conta ?? key,
      contaNormalizada: key,
      descricao: meta?.descricao ?? "Sem descricao",
      atual,
      anterior,
      delta: atual - anterior,
      userId: meta?.userId,
      setor: meta?.setor,
      uploadBatchId: meta?.uploadBatchId,
    };
  });
}

export function SyntheticPage({ profile }: { profile: Profile }) {
  const navigate = useNavigate();
  const data = useAccountingData(profile);
  const [mes, setMes] = useState("todos");
  const [grupo, setGrupo] = useState("todos");
  const [conta, setConta] = useState("");
  const [descricao, setDescricao] = useState("");
  const [page, setPage] = useState(1);
  const [chartMode, setChartMode] = useState<"total" | "novoAusente" | "variacao">("total");
  const [risePage, setRisePage] = useState(1);
  const [dropPage, setDropPage] = useState(1);
  const [selectedNovoAusenteMes, setSelectedNovoAusenteMes] = useState<string | null>(null);
  const pageSize = 20;
  const impactListPageSize = 10;

  const filteredSynthetic = useMemo(
    () =>
      data.syntheticRows.filter(
        (r) =>
          (mes === "todos" || r.mes === mes) &&
          (grupo === "todos" || r.grupo === grupo) &&
          (!conta || r.conta.toLowerCase().includes(conta.toLowerCase())) &&
          (!descricao || r.descricao.toLowerCase().includes(descricao.toLowerCase()))
      ),
    [data.syntheticRows, mes, grupo, conta, descricao]
  );

  const filteredAnalytical = useMemo(
    () =>
      data.analyticalRows.filter(
        (r) =>
          (mes === "todos" || r.mes === mes) &&
          (!conta || r.conta.toLowerCase().includes(conta.toLowerCase())) &&
          (!descricao || r.descricao.toLowerCase().includes(descricao.toLowerCase()))
      ),
    [data.analyticalRows, mes, conta, descricao]
  );

  const inconsistencies = useMemo(() => calculateInconsistencies(filteredSynthetic, filteredAnalytical), [filteredSynthetic, filteredAnalytical]);
  const statusMap = useMemo(() => new Map(inconsistencies.map((i) => [`${i.conta}::${i.mes}`, i])), [inconsistencies]);
  const sortedSynthetic = useMemo(() => [...filteredSynthetic].sort((a, b) => b.total - a.total), [filteredSynthetic]);
  const totalPages = Math.max(1, Math.ceil(sortedSynthetic.length / pageSize));

  const paginatedSynthetic = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return sortedSynthetic.slice(start, start + pageSize);
  }, [sortedSynthetic, page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [mes, grupo, conta, descricao, data.adminSetor, data.adminUser]);

  const total = filteredSynthetic.reduce((s, r) => s + r.total, 0);
  const byMonth = data.months.map((m) => ({ mes: m, total: filteredSynthetic.filter((r) => r.mes === m).reduce((s, r) => s + r.total, 0) }));

  const variationByMonth = useMemo(() => {
    const monthTotals = new Map<string, number>();
    for (const r of filteredSynthetic) monthTotals.set(r.mes, (monthTotals.get(r.mes) ?? 0) + r.total);

    const availableMonths = data.months.filter((m) => (monthTotals.get(m) ?? 0) !== 0);
    if (availableMonths.length < 2) {
      return {
        currentMonth: null as string | null,
        previousMonth: null as string | null,
        riseList: [] as ContaDelta[],
        dropList: [] as ContaDelta[],
        topRise: null as ContaDelta | null,
        topDrop: null as ContaDelta | null,
        chartData: [] as ImpactChartPoint[],
      };
    }

    const chartData: ImpactChartPoint[] = [];
    for (let i = 1; i < availableMonths.length; i += 1) {
      const month = availableMonths[i];
      const previous = availableMonths[i - 1];
      const deltas = buildContaDeltasForMonth(filteredSynthetic, month, previous);
      const topRise = [...deltas].sort((a, b) => b.delta - a.delta)[0] ?? null;
      const topDrop = [...deltas].sort((a, b) => a.delta - b.delta)[0] ?? null;

      chartData.push({
        mes: month,
        subidaConta: topRise?.conta ?? "-",
        subidaDescricao: topRise?.descricao ?? "Sem descricao",
        subida: Math.max(0, topRise?.delta ?? 0),
        quedaConta: topDrop?.conta ?? "-",
        quedaDescricao: topDrop?.descricao ?? "Sem descricao",
        queda: Math.abs(Math.min(0, topDrop?.delta ?? 0)),
      });
    }

    const currentMonth = availableMonths[availableMonths.length - 1];
    const previousMonth = availableMonths[availableMonths.length - 2];
    const currentDeltas = buildContaDeltasForMonth(filteredSynthetic, currentMonth, previousMonth);
    const riseList = [...currentDeltas].filter((r) => r.delta > 0).sort((a, b) => b.delta - a.delta);
    const dropList = [...currentDeltas].filter((r) => r.delta < 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    return { currentMonth, previousMonth, riseList, dropList, topRise: riseList[0] ?? null, topDrop: dropList[0] ?? null, chartData };
  }, [data.months, filteredSynthetic]);

  const novoAusenteByMonth = useMemo(() => {
    const monthTotals = new Map<string, number>();
    for (const r of filteredSynthetic) monthTotals.set(r.mes, (monthTotals.get(r.mes) ?? 0) + r.total);
    const availableMonths = data.months.filter((m) => (monthTotals.get(m) ?? 0) !== 0);

    if (availableMonths.length < 2) {
      return { chartData: [] as NovoAusenteChartPoint[], latestNovas: [] as NovoAusenteItem[], latestAusentes: [] as NovoAusenteItem[] };
    }

    const chartData: NovoAusenteChartPoint[] = [];
    for (let i = 1; i < availableMonths.length; i += 1) {
      const mesAtual = availableMonths[i];
      const mesAnterior = availableMonths[i - 1];
      const currentMap = new Map<string, NovoAusenteItem>();
      const previousMap = new Map<string, NovoAusenteItem>();

      for (const r of filteredSynthetic) {
        const cn = normalizeContaForCompare(r.conta);
        if (!cn) continue;
        if (r.mes === mesAtual) currentMap.set(cn, { mes: mesAtual, conta: r.conta, contaNormalizada: cn, descricao: r.descricao || "Sem descricao", total: r.total, userId: r.userId, setor: r.setor, uploadBatchId: r.uploadBatchId });
        if (r.mes === mesAnterior) previousMap.set(cn, { mes: mesAtual, conta: r.conta, contaNormalizada: cn, descricao: r.descricao || "Sem descricao", total: r.total, userId: r.userId, setor: r.setor, uploadBatchId: r.uploadBatchId });
      }

      const novasItems = [...currentMap.entries()].filter(([k]) => !previousMap.has(k)).map(([, v]) => v).sort((a, b) => b.total - a.total);
      const ausentesItems = [...previousMap.entries()].filter(([k]) => !currentMap.has(k)).map(([, v]) => v).sort((a, b) => b.total - a.total);

      chartData.push({
        mes: mesAtual,
        novas: novasItems.reduce((s, x) => s + Math.abs(x.total), 0),
        ausentes: ausentesItems.reduce((s, x) => s + Math.abs(x.total), 0),
        novasItems,
        ausentesItems,
      });
    }

    const latest = chartData[chartData.length - 1];
    return { chartData, latestNovas: latest?.novasItems ?? [], latestAusentes: latest?.ausentesItems ?? [] };
  }, [data.months, filteredSynthetic]);

  useEffect(() => {
    setRisePage(1);
    setDropPage(1);
  }, [variationByMonth.currentMonth, mes, grupo, conta, descricao]);

  useEffect(() => {
    setSelectedNovoAusenteMes(novoAusenteByMonth.chartData[novoAusenteByMonth.chartData.length - 1]?.mes ?? null);
  }, [novoAusenteByMonth.chartData]);

  const riseTotalPages = Math.max(1, Math.ceil(variationByMonth.riseList.length / impactListPageSize));
  const dropTotalPages = Math.max(1, Math.ceil(variationByMonth.dropList.length / impactListPageSize));

  const risePageItems = useMemo(() => {
    const safePage = Math.min(risePage, riseTotalPages);
    const start = (safePage - 1) * impactListPageSize;
    return variationByMonth.riseList.slice(start, start + impactListPageSize);
  }, [risePage, riseTotalPages, variationByMonth.riseList]);

  const dropPageItems = useMemo(() => {
    const safePage = Math.min(dropPage, dropTotalPages);
    const start = (safePage - 1) * impactListPageSize;
    return variationByMonth.dropList.slice(start, start + impactListPageSize);
  }, [dropPage, dropTotalPages, variationByMonth.dropList]);

  const goToAnaliticoLinked = (item: { contaNormalizada: string; descricao: string; mes: string; uploadBatchId?: string; userId?: string; setor?: string }) => {
    const q = new URLSearchParams({ linked: "1", conta: item.contaNormalizada, descricao: item.descricao, originMes: item.mes });
    if (item.uploadBatchId) q.set("originBatch", item.uploadBatchId);
    if (profile.role === "admin") {
      if (item.userId) q.set("uid", item.userId);
      if (item.setor) q.set("setor", item.setor);
    }
    navigate(`/analitico?${q.toString()}`);
  };

  const selectedNovoAusente = novoAusenteByMonth.chartData.find((x) => x.mes === selectedNovoAusenteMes);

  return <div className="mx-auto max-w-[1400px] p-6 space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">Sintetico</h1><p className="text-slate-700 dark:text-slate-300">Resumo consolidado por Conta, Descricao, Total, Grupo e Mes.</p><p className="mt-1 text-xs text-slate-700 dark:text-slate-300">Envie um arquivo XLSX contendo duas abas: Sintetico e Analitico. A aba Sintetico deve conter Conta, Descricao, Total, Grupo e Mes. A aba Analitico deve conter Conta, Descricao, Valor, Forma e Mes. A coluna Conta sera usada como referencia principal entre resumo e detalhe.</p></div><div className="flex gap-2"><Button className="bg-green-700 text-white" onClick={() => document.getElementById("xlsxInput")?.click()}>Importar XLSX</Button><input id="xlsxInput" type="file" accept=".xlsx" className="hidden" onChange={(e) => e.target.files?.[0] && data.upload(e.target.files[0])} /><Button className="bg-emerald-700 text-white" onClick={() => exportViewToXlsx({ sintetico: filteredSynthetic, analitico: filteredAnalytical, fileName: `sintetico_${new Date().toISOString().slice(0, 10)}.xlsx` })}>Exportar</Button><Button className="border border-[var(--border)] text-[var(--text)] bg-[var(--card)]" onClick={exportTemplateXlsx}>Baixar modelo</Button></div></header>

    {data.lastUploadSummary && <Card className="p-3 text-sm"><span className="font-semibold">Upload:</span> {data.lastUploadSummary.fileName} | Sintetico: {data.lastUploadSummary.syntheticRowsCount} | Analitico: {data.lastUploadSummary.analyticRowsCount} | Inconsistencias: {data.lastUploadSummary.inconsistenciesCount} | Data: {new Date(data.lastUploadSummary.createdAt).toLocaleString("pt-BR")}</Card>}
    {data.error && <Card className="p-3 text-sm text-red-700">{data.error}</Card>}

    <Card className="p-4"><div className="grid gap-3 md:grid-cols-5"><select className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2" value={mes} onChange={(e) => setMes(e.target.value)}><option value="todos">Todos os meses</option>{data.months.map((m) => <option key={m}>{m}</option>)}</select><select className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2" value={grupo} onChange={(e) => setGrupo(e.target.value)}><option value="todos">Todos os grupos</option>{data.groups.map((g) => <option key={g}>{g}</option>)}</select><input className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2" placeholder="Conta" value={conta} onChange={(e) => setConta(e.target.value)} /><input className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2" placeholder="Descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} />{profile.role === "admin" && <select className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2" value={data.adminSetor} onChange={(e) => data.setAdminSetor(e.target.value)}><option value="todos">Todos os setores</option>{SETORES.map((s) => <option key={s}>{s}</option>)}</select>}{profile.role === "admin" && <select className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2" value={data.adminUser} onChange={(e) => data.setAdminUser(e.target.value)}><option value="todos">Todos os usuarios</option>{data.users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select>}</div></Card>

    <div className="grid gap-3 md:grid-cols-6"><Card className="p-4"><p className="text-xs text-slate-700 dark:text-slate-300">Total geral</p><p className="mt-2 text-lg font-semibold tabular">{formatBRL(total)}</p></Card><Card className="p-4"><p className="text-xs text-slate-700 dark:text-slate-300">Qtd. contas</p><p className="mt-2 text-lg font-semibold tabular">{new Set(filteredSynthetic.map((r) => r.conta)).size}</p></Card><Card className="p-4"><p className="text-xs text-slate-700 dark:text-slate-300">Maior conta</p><p className="mt-2 text-sm font-semibold">{sortedSynthetic[0]?.conta ?? "�"}</p></Card><Card className="p-4"><p className="text-xs text-slate-700 dark:text-slate-300">Grupo com maior valor</p><p className="mt-2 text-sm font-semibold">{Object.entries(filteredSynthetic.reduce((a, r) => { a[r.grupo] = (a[r.grupo] ?? 0) + r.total; return a; }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "�"}</p></Card><Card className="p-4 cursor-pointer hover:ring-1 hover:ring-green-600" onClick={() => setChartMode("novoAusente")}><p className="text-xs text-slate-700 dark:text-slate-300">Novo / Ausente</p><div className="mt-2 border-b border-[var(--border)] pb-2"><div className="flex items-center justify-between gap-2"><span className="font-semibold">{novoAusenteByMonth.latestNovas[0]?.conta ?? "�"}</span><MessageCirclePlus size={16} className="text-green-700" /></div><p className="mt-1 text-xs tabular text-green-700">{formatBRL(novoAusenteByMonth.latestNovas[0]?.total ?? 0)}</p></div><div className="pt-2"><div className="flex items-center justify-between gap-2"><span className="font-semibold">{novoAusenteByMonth.latestAusentes[0]?.conta ?? "�"}</span><CircleX size={16} className="text-red-700" /></div><p className="mt-1 text-xs tabular text-red-700">{formatBRL(novoAusenteByMonth.latestAusentes[0]?.total ?? 0)}</p></div></Card><Card className="p-4 cursor-pointer hover:ring-1 hover:ring-green-600" onClick={() => setChartMode("variacao")}><p className="text-xs text-slate-700 dark:text-slate-300">Variacao</p><div className="mt-2 border-b border-[var(--border)] pb-2"><div className="flex items-center justify-between gap-2"><span className="font-semibold">{variationByMonth.topRise?.conta ?? "�"}</span><span className="font-bold text-red-700">&#9650;</span></div><p className="mt-1 text-xs tabular text-red-700">{formatBRL(variationByMonth.topRise?.delta ?? 0)}</p></div><div className="pt-2"><div className="flex items-center justify-between gap-2"><span className="font-semibold">{variationByMonth.topDrop?.conta ?? "�"}</span><span className="font-bold text-green-700">&#9660;</span></div><p className="mt-1 text-xs tabular text-green-700">{formatBRL(Math.abs(variationByMonth.topDrop?.delta ?? 0))}</p></div></Card></div>

    <Card className="p-4"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-semibold">{chartMode === "total" ? "Evolucao mensal do total" : chartMode === "novoAusente" ? "Contas novas x ausentes por mes" : "Impacto por conta: subida x queda"}</h3><div className="flex gap-2"><Button className={chartMode === "total" ? "bg-green-700 text-white" : "border border-[var(--border)] text-[var(--text)] bg-[var(--card)]"} onClick={() => setChartMode("total")}>Total</Button><Button className={chartMode === "novoAusente" ? "bg-green-700 text-white" : "border border-[var(--border)] text-[var(--text)] bg-[var(--card)]"} onClick={() => setChartMode("novoAusente")}>Novo / Ausente</Button><Button className={chartMode === "variacao" ? "bg-green-700 text-white" : "border border-[var(--border)] text-[var(--text)] bg-[var(--card)]"} onClick={() => setChartMode("variacao")}>Variacao</Button></div></div><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%">{chartMode === "total" ? <BarChart data={byMonth}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" /><YAxis /><Tooltip formatter={(v) => formatBRL(Number(v ?? 0))} /><Bar dataKey="total" fill="#15803d" isAnimationActive /></BarChart> : chartMode === "novoAusente" ? <BarChart data={novoAusenteByMonth.chartData} onClick={(state) => { const s = state as unknown as { activePayload?: Array<{ payload?: NovoAusenteChartPoint }> }; const m = s.activePayload?.[0]?.payload?.mes; if (m) setSelectedNovoAusenteMes(m); }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" /><YAxis /><Tooltip formatter={(v) => formatBRL(Number(v ?? 0))} /><Bar dataKey="ausentes" name="Ausentes" fill="#dc2626" isAnimationActive /><Bar dataKey="novas" name="Novas" fill="#15803d" isAnimationActive /></BarChart> : <BarChart data={variationByMonth.chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" /><YAxis /><Tooltip formatter={(v) => formatBRL(Number(v ?? 0))} /><Bar dataKey="subida" name="Subida" fill="#dc2626" isAnimationActive /><Bar dataKey="queda" name="Queda" fill="#15803d" isAnimationActive /></BarChart>}</ResponsiveContainer></div></Card>

    {chartMode === "novoAusente" ? <div className="grid gap-4 md:grid-cols-2"><Card className="p-3"><h4 className="font-semibold text-green-700">Novas</h4><p className="mt-1 text-xs text-slate-700 dark:text-slate-300">Mes selecionado: {selectedNovoAusenteMes ?? "�"}</p><div className="mt-2 space-y-2 text-sm max-h-[360px] overflow-y-auto pr-1">{(selectedNovoAusente?.novasItems ?? []).map((r, idx) => <button key={`novo-${r.contaNormalizada}-${idx}`} className="w-full rounded-md border border-[var(--border)] p-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => goToAnaliticoLinked(r)}><p className="font-medium">{r.conta}</p><p className="text-xs text-slate-700 dark:text-slate-300">{r.descricao}</p><div className="mt-1 flex items-center justify-between"><span className="text-xs text-slate-700 dark:text-slate-300">{r.mes}</span><span className="tabular text-green-700">{formatBRL(r.total)}</span></div></button>)}{(selectedNovoAusente?.novasItems ?? []).length === 0 && <p className="text-sm text-slate-700 dark:text-slate-300">Nenhuma conta nova.</p>}</div></Card><Card className="p-3"><h4 className="font-semibold text-red-700">Ausentes</h4><p className="mt-1 text-xs text-slate-700 dark:text-slate-300">Mes selecionado: {selectedNovoAusenteMes ?? "�"}</p><div className="mt-2 space-y-2 text-sm max-h-[360px] overflow-y-auto pr-1">{(selectedNovoAusente?.ausentesItems ?? []).map((r, idx) => <button key={`aus-${r.contaNormalizada}-${idx}`} className="w-full rounded-md border border-[var(--border)] p-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => goToAnaliticoLinked(r)}><p className="font-medium">{r.conta}</p><p className="text-xs text-slate-700 dark:text-slate-300">{r.descricao}</p><div className="mt-1 flex items-center justify-between"><span className="text-xs text-slate-700 dark:text-slate-300">{r.mes}</span><span className="tabular text-red-700">{formatBRL(r.total)}</span></div></button>)}{(selectedNovoAusente?.ausentesItems ?? []).length === 0 && <p className="text-sm text-slate-700 dark:text-slate-300">Nenhuma conta ausente.</p>}</div></Card></div> : <div className="grid gap-4 md:grid-cols-2"><Card className="p-3"><h4 className="font-semibold text-red-700">Contas que fizeram subir</h4><p className="mt-1 text-xs text-slate-700 dark:text-slate-300">Mes de referencia: {variationByMonth.currentMonth ?? "�"} (comparado a {variationByMonth.previousMonth ?? "�"})</p><div className="mt-2 space-y-2 text-sm max-h-[360px] overflow-y-auto pr-1">{risePageItems.map((r, idx) => <button key={`rise-${r.contaNormalizada}-${idx}`} className="w-full rounded-md border border-[var(--border)] p-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => goToAnaliticoLinked(r)}><p className="font-medium">{r.conta}</p><p className="text-xs text-slate-700 dark:text-slate-300">{r.descricao}</p><div className="mt-1 flex items-center justify-between"><span className="text-xs text-slate-700 dark:text-slate-300">{r.mes}</span><span className="tabular text-red-700">{formatBRL(r.delta)}</span></div></button>)}{variationByMonth.riseList.length === 0 && <p className="text-sm text-slate-700 dark:text-slate-300">Nenhuma conta com subida.</p>}</div><div className="mt-2 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300"><span>Pagina {Math.min(risePage, riseTotalPages)} de {riseTotalPages}</span><div className="flex gap-2"><Button className="border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[var(--text)]" onClick={() => setRisePage((p) => Math.max(1, p - 1))} disabled={risePage <= 1}>Anterior</Button><Button className="border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[var(--text)]" onClick={() => setRisePage((p) => Math.min(riseTotalPages, p + 1))} disabled={risePage >= riseTotalPages}>Proxima</Button></div></div></Card><Card className="p-3"><h4 className="font-semibold text-green-700">Contas que fizeram cair</h4><p className="mt-1 text-xs text-slate-700 dark:text-slate-300">Mes de referencia: {variationByMonth.currentMonth ?? "�"} (comparado a {variationByMonth.previousMonth ?? "�"})</p><div className="mt-2 space-y-2 text-sm max-h-[360px] overflow-y-auto pr-1">{dropPageItems.map((r, idx) => <button key={`drop-${r.contaNormalizada}-${idx}`} className="w-full rounded-md border border-[var(--border)] p-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => goToAnaliticoLinked(r)}><p className="font-medium">{r.conta}</p><p className="text-xs text-slate-700 dark:text-slate-300">{r.descricao}</p><div className="mt-1 flex items-center justify-between"><span className="text-xs text-slate-700 dark:text-slate-300">{r.mes}</span><span className="tabular text-green-700">{formatBRL(Math.abs(r.delta))}</span></div></button>)}{variationByMonth.dropList.length === 0 && <p className="text-sm text-slate-700 dark:text-slate-300">Nenhuma conta com queda.</p>}</div><div className="mt-2 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300"><span>Pagina {Math.min(dropPage, dropTotalPages)} de {dropTotalPages}</span><div className="flex gap-2"><Button className="border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[var(--text)]" onClick={() => setDropPage((p) => Math.max(1, p - 1))} disabled={dropPage <= 1}>Anterior</Button><Button className="border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[var(--text)]" onClick={() => setDropPage((p) => Math.min(dropTotalPages, p + 1))} disabled={dropPage >= dropTotalPages}>Proxima</Button></div></div></Card></div>}

    <Card className="overflow-auto"><table className="w-full text-sm"><thead className="bg-slate-50 dark:bg-slate-800"><tr><th className="px-3 py-2 text-left">Conta</th><th className="px-3 py-2 text-left">Descricao</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-left">Grupo</th><th className="px-3 py-2 text-left">Mes</th><th className="px-3 py-2 text-left">Status de conciliacao</th><th className="px-3 py-2 text-left">Acoes</th></tr></thead><tbody>{paginatedSynthetic.map((r) => { const st = statusMap.get(`${r.conta}::${r.mes}`); const status = st?.status ?? "Sem analitico"; return <tr key={`${r.conta}-${r.mes}-${r.grupo}`} className="border-t border-[var(--border)]"><td className="px-3 py-2">{r.conta}</td><td className="px-3 py-2">{r.descricao}</td><td className="px-3 py-2 text-right tabular">{formatBRL(r.total)}</td><td className="px-3 py-2">{r.grupo}</td><td className="px-3 py-2">{r.mes}</td><td className={`px-3 py-2 ${status === "OK" ? "text-green-700" : status === "Divergente" ? "text-red-700" : "text-slate-700 dark:text-slate-300"}`}>{status}{st && status === "Divergente" ? ` (${formatBRL(st.diff)})` : ""}</td><td className="px-3 py-2"><button className="text-green-700" onClick={() => navigate(`/analitico?linked=1&conta=${encodeURIComponent(normalizeContaForCompare(r.conta))}&descricao=${encodeURIComponent(r.descricao)}&originMes=${encodeURIComponent(r.mes)}&originBatch=${encodeURIComponent(r.uploadBatchId ?? "")}&uid=${encodeURIComponent(r.userId ?? "")}&setor=${encodeURIComponent(r.setor ?? "")}`)}>Ver analitico</button></td></tr>; })}</tbody></table><div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-2 text-sm"><span>Pagina {Math.min(page, totalPages)} de {totalPages} � {filteredSynthetic.length} registros</span><div className="flex gap-2"><Button className="border border-[var(--border)] text-[var(--text)] bg-[var(--card)]" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Anterior</Button><Button className="border border-[var(--border)] text-[var(--text)] bg-[var(--card)]" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Proxima</Button></div></div></Card>
  </div>;
}
