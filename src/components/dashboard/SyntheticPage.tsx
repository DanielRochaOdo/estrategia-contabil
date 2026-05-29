import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Card } from "../ui/primitives";
import { calculateInconsistencies, exportTemplateXlsx, exportViewToXlsx, formatBRL } from "../../lib/accounting";
import type { Profile } from "../../lib/auth";
import { SETORES } from "../../lib/constants";
import { useAccountingData } from "./useAccountingData";

export function SyntheticPage({ profile }: { profile: Profile }) {
  const navigate = useNavigate();
  const data = useAccountingData(profile);
  const [mes, setMes] = useState("todos");
  const [grupo, setGrupo] = useState("todos");
  const [conta, setConta] = useState("");
  const [descricao, setDescricao] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const filteredSynthetic = useMemo(() => data.syntheticRows.filter((r) => (mes === "todos" || r.mes === mes) && (grupo === "todos" || r.grupo === grupo) && (!conta || r.conta.toLowerCase().includes(conta.toLowerCase())) && (!descricao || r.descricao.toLowerCase().includes(descricao.toLowerCase()))), [data.syntheticRows, mes, grupo, conta, descricao]);
  const filteredAnalytical = useMemo(() => data.analyticalRows.filter((r) => (mes === "todos" || r.mes === mes) && (!conta || r.conta.toLowerCase().includes(conta.toLowerCase())) && (!descricao || r.descricao.toLowerCase().includes(descricao.toLowerCase()))), [data.analyticalRows, mes, conta, descricao]);

  const inconsistencies = useMemo(() => calculateInconsistencies(filteredSynthetic, filteredAnalytical), [filteredSynthetic, filteredAnalytical]);
  const statusMap = useMemo(() => new Map(inconsistencies.map((i) => [`${i.conta}::${i.mes}`, i])), [inconsistencies]);
  const sortedSynthetic = useMemo(
    () => [...filteredSynthetic].sort((a, b) => b.total - a.total),
    [filteredSynthetic]
  );
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

  return <div className="mx-auto max-w-[1400px] p-6 space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">Sintético</h1><p className="text-slate-700 dark:text-slate-300">Resumo consolidado por Conta, Descrição, Total, Grupo e Mês.</p><p className="mt-1 text-xs text-slate-700 dark:text-slate-300">Envie um arquivo XLSX contendo duas abas: Sintético e Analítico. A aba Sintético deve conter Conta, Descrição, Total, Grupo e Mês. A aba Analítico deve conter Conta, Descrição, Valor, Forma e Mês. A coluna Conta será usada como referência principal entre resumo e detalhe.</p></div><div className="flex gap-2"><Button className="bg-green-700 text-white" onClick={() => document.getElementById("xlsxInput")?.click()}>Importar XLSX</Button><input id="xlsxInput" type="file" accept=".xlsx" className="hidden" onChange={(e) => e.target.files?.[0] && data.upload(e.target.files[0])} /><Button className="bg-emerald-700 text-white" onClick={() => exportViewToXlsx({ sintetico: filteredSynthetic, analitico: filteredAnalytical, fileName: `sintetico_${new Date().toISOString().slice(0,10)}.xlsx` })}>Exportar</Button><Button className="border border-[var(--border)] text-[var(--text)] bg-[var(--card)]" onClick={exportTemplateXlsx}>Baixar modelo</Button></div></header>

    {data.lastUploadSummary && <Card className="p-3 text-sm"><span className="font-semibold">Upload:</span> {data.lastUploadSummary.fileName} | Sintético: {data.lastUploadSummary.syntheticRowsCount} | Analítico: {data.lastUploadSummary.analyticRowsCount} | Inconsistências: {data.lastUploadSummary.inconsistenciesCount} | Data: {new Date(data.lastUploadSummary.createdAt).toLocaleString("pt-BR")}</Card>}
    {data.error && <Card className="p-3 text-sm text-red-700">{data.error}</Card>}

    <Card className="p-4"><div className="grid gap-3 md:grid-cols-5"><select className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2" value={mes} onChange={(e) => setMes(e.target.value)}><option value="todos">Todos os meses</option>{data.months.map((m) => <option key={m}>{m}</option>)}</select><select className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2" value={grupo} onChange={(e) => setGrupo(e.target.value)}><option value="todos">Todos os grupos</option>{data.groups.map((g) => <option key={g}>{g}</option>)}</select><input className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2" placeholder="Conta" value={conta} onChange={(e) => setConta(e.target.value)} /><input className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2" placeholder="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} />{profile.role === "admin" && <select className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2" value={data.adminSetor} onChange={(e) => data.setAdminSetor(e.target.value)}><option value="todos">Todos os setores</option>{SETORES.map((s) => <option key={s}>{s}</option>)}</select>}{profile.role === "admin" && <select className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2" value={data.adminUser} onChange={(e) => data.setAdminUser(e.target.value)}><option value="todos">Todos os usuários</option>{data.users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select>}</div></Card>

    <div className="grid gap-3 md:grid-cols-5"><Card className="p-4"><p className="text-xs text-slate-700 dark:text-slate-300">Total geral</p><p className="mt-2 text-lg font-semibold tabular">{formatBRL(total)}</p></Card><Card className="p-4"><p className="text-xs text-slate-700 dark:text-slate-300">Qtd. contas</p><p className="mt-2 text-lg font-semibold tabular">{new Set(filteredSynthetic.map((r) => r.conta)).size}</p></Card><Card className="p-4"><p className="text-xs text-slate-700 dark:text-slate-300">Maior conta</p><p className="mt-2 text-sm font-semibold">{sortedSynthetic[0]?.conta ?? "—"}</p></Card><Card className="p-4"><p className="text-xs text-slate-700 dark:text-slate-300">Grupo com maior valor</p><p className="mt-2 text-sm font-semibold">{Object.entries(filteredSynthetic.reduce((a,r)=>{a[r.grupo]=(a[r.grupo]??0)+r.total;return a;},{} as Record<string,number>)).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? "—"}</p></Card><Card className="p-4"><p className="text-xs text-slate-700 dark:text-slate-300">Mês com maior valor</p><p className="mt-2 text-sm font-semibold">{[...byMonth].sort((a,b)=>b.total-a.total)[0]?.mes ?? "—"}</p></Card></div>

    <Card className="p-4"><h3 className="mb-3 font-semibold">Evolução mensal do total</h3><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={byMonth}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" /><YAxis /><Tooltip formatter={(v)=>formatBRL(Number(v ?? 0))} /><Bar dataKey="total" fill="#15803d" isAnimationActive /></BarChart></ResponsiveContainer></div></Card>

    <Card className="overflow-auto"><table className="w-full text-sm"><thead className="bg-slate-50 dark:bg-slate-800"><tr><th className="px-3 py-2 text-left">Conta</th><th className="px-3 py-2 text-left">Descrição</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-left">Grupo</th><th className="px-3 py-2 text-left">Mês</th><th className="px-3 py-2 text-left">Status de conciliação</th><th className="px-3 py-2 text-left">Ações</th></tr></thead><tbody>{paginatedSynthetic.map((r) => { const st = statusMap.get(`${r.conta}::${r.mes}`); const status = st?.status ?? "Sem analítico"; return <tr key={`${r.conta}-${r.mes}-${r.grupo}`} className="border-t border-[var(--border)]"><td className="px-3 py-2">{r.conta}</td><td className="px-3 py-2">{r.descricao}</td><td className="px-3 py-2 text-right tabular">{formatBRL(r.total)}</td><td className="px-3 py-2">{r.grupo}</td><td className="px-3 py-2">{r.mes}</td><td className={`px-3 py-2 ${status === "OK" ? "text-green-700" : status === "Divergente" ? "text-red-700" : "text-slate-700 dark:text-slate-300"}`}>{status}{st && status === "Divergente" ? ` (${formatBRL(st.diff)})` : ""}</td><td className="px-3 py-2"><button className="text-green-700" onClick={() => navigate(`/analitico?linked=1&conta=${encodeURIComponent(r.conta)}&mes=${encodeURIComponent(r.mes)}&descricao=${encodeURIComponent(r.descricao)}&batch=${encodeURIComponent(r.uploadBatchId ?? "")}&uid=${encodeURIComponent(r.userId ?? "")}&setor=${encodeURIComponent(r.setor ?? "")}`)}>Ver analítico</button></td></tr>; })}</tbody></table><div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-2 text-sm"><span>Página {Math.min(page, totalPages)} de {totalPages} • {filteredSynthetic.length} registros</span><div className="flex gap-2"><Button className="border border-[var(--border)] text-[var(--text)] bg-[var(--card)]" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Anterior</Button><Button className="border border-[var(--border)] text-[var(--text)] bg-[var(--card)]" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Próxima</Button></div></div></Card>
  </div>;
}




