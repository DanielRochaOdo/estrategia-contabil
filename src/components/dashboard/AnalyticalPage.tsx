import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Card } from "../ui/primitives";
import { exportViewToXlsx, formatBRL, normalizeContaForCompare } from "../../lib/accounting";
import type { Profile } from "../../lib/auth";
import { SETORES } from "../../lib/constants";
import { fetchAnalyticalLinkedRecords } from "../../lib/accountingStore";
import { useAccountingData } from "./useAccountingData";

export function AnalyticalPage({ profile }: { profile: Profile }) {
  const data = useAccountingData(profile);
  const [params, setParams] = useSearchParams();

  const linkedMode = params.get("linked") === "1";
  const originMes = params.get("originMes") ?? "";
  const originBatch = params.get("originBatch") ?? "";

  const [mes, setMes] = useState(linkedMode ? "todos" : (params.get("mes") ?? "todos"));
  const [conta, setConta] = useState(params.get("conta") ?? "");
  const [descricao, setDescricao] = useState(params.get("descricao") ?? "");
  const [forma, setForma] = useState("todos");
  const [linkedUserId, setLinkedUserId] = useState(params.get("uid") ?? "");
  const [linkedSetor, setLinkedSetor] = useState(params.get("setor") ?? "");
  const [linkedBaseRows, setLinkedBaseRows] = useState<Array<any>>([]);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    setMes(linkedMode ? "todos" : (params.get("mes") ?? "todos"));
    setConta(params.get("conta") ?? "");
    setDescricao(params.get("descricao") ?? "");
    setLinkedUserId(params.get("uid") ?? "");
    setLinkedSetor(params.get("setor") ?? "");
    setForma("todos");
  }, [linkedMode, params]);

  useEffect(() => {
    let active = true;
    if (!linkedMode || !conta) {
      setLinkedBaseRows([]);
      return;
    }

    const scope = { userId: profile.id, role: profile.role, filterSetor: data.adminSetor, filterUserId: data.adminUser } as const;
    void fetchAnalyticalLinkedRecords({
      scope,
      conta,
      descricao: descricao || undefined,
      linkedUserId: linkedUserId || undefined,
      linkedSetor: linkedSetor || undefined,
    }).then((rows) => {
      if (!active) return;
      setLinkedBaseRows(rows);
    }).catch(() => {
      if (!active) return;
      setLinkedBaseRows([]);
    });

    return () => {
      active = false;
    };
  }, [linkedMode, conta, linkedUserId, linkedSetor, profile.id, profile.role, data.adminSetor, data.adminUser]);

  const baseRows = linkedMode ? linkedBaseRows : data.analyticalRows;

  const filteredRows = useMemo(() => {
    const normalizedConta = conta.trim().toLowerCase();
    const normalizedDescricao = descricao.trim().toLowerCase();

    return baseRows.filter((r) => {
      const contaOk = !normalizedConta || normalizeContaForCompare(r.conta).includes(normalizeContaForCompare(normalizedConta));
      const descricaoOk = !normalizedDescricao || r.descricao.toLowerCase().includes(normalizedDescricao);
      const mesOk = mes === "todos" || r.mes === mes;
      const formaOk = forma === "todos" || r.forma === forma;
      return contaOk && descricaoOk && mesOk && formaOk;
    });
  }, [baseRows, mes, conta, descricao, forma]);

  const sourceRows = filteredRows;

  const deduped = useMemo(() => Array.from(new Map(sourceRows.map((r) => {
    const normalizedConta = normalizeContaForCompare(r.conta);
    const key = r.recordId
      ? `id::${r.recordId}`
      : `semid::${normalizedConta}::${r.descricao}::${r.valor}::${r.forma}::${r.mes}::${r.userId ?? ""}::${r.uploadBatchId ?? ""}`;
    return [key, r];
  })).values()), [sourceRows]);

  const sortedAnalytical = useMemo(() => [...deduped].sort((a, b) => b.valor - a.valor), [deduped]);

  const linkedSynthetic = useMemo(() => data.syntheticRows.filter((s) => {
    const contaOk = !conta || normalizeContaForCompare(s.conta) === normalizeContaForCompare(conta);
    return contaOk && (mes === "todos" || s.mes === mes);
  }), [data.syntheticRows, conta, mes]);

  const totalPages = Math.max(1, Math.ceil(sortedAnalytical.length / pageSize));
  const paginated = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return sortedAnalytical.slice(start, start + pageSize);
  }, [sortedAnalytical, page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [mes, conta, descricao, forma, linkedUserId, linkedSetor, data.adminSetor, data.adminUser, linkedMode]);

  const total = sortedAnalytical.reduce((s, r) => s + r.valor, 0);
  const byMonth = data.months.map((m) => ({ mes: m, total: sortedAnalytical.filter((r) => r.mes === m).reduce((s, r) => s + r.valor, 0) }));
  const byForma = Object.entries(sortedAnalytical.reduce((a, r) => { a[r.forma] = (a[r.forma] ?? 0) + r.valor; return a; }, {} as Record<string, number>)).map(([name, value]) => ({ name, value }));
  const pieColors = ["#166534", "#15803d", "#16a34a", "#22c55e", "#65a30d", "#84cc16", "#059669", "#0d9488"];

  return <div className="mx-auto max-w-[1400px] p-6 space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">Analitico</h1><p className="text-slate-700 dark:text-slate-300">Lancamentos detalhados por Conta, Descricao, Valor, Forma e Mes.</p>{linkedMode && <p className="mt-1 text-sm text-green-700">Exibindo historico da Conta {conta || "—"}{originMes ? ` - origem: ${originMes}` : ""}{originBatch ? ` | lote origem: ${originBatch}` : ""}</p>}</div><div className="flex gap-2"><Button className="bg-green-700 text-white" onClick={() => exportViewToXlsx({ sintetico: linkedSynthetic, analitico: sortedAnalytical, fileName: `analitico_${new Date().toISOString().slice(0,10)}.xlsx` })}>Exportar</Button><Button className="border border-[var(--border)] text-[var(--text)] bg-[var(--card)]" onClick={() => { setParams({}); setConta(""); setDescricao(""); setMes("todos"); setLinkedUserId(""); setLinkedSetor(""); setForma("todos"); }}>Limpar filtro vinculado</Button></div></header>

    <Card className="p-4"><div className="grid gap-3 md:grid-cols-5"><select className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2" value={mes} onChange={(e) => setMes(e.target.value)}><option value="todos">Todos os meses</option>{data.months.map((m) => <option key={m}>{m}</option>)}</select><input className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2" placeholder="Conta" value={conta} onChange={(e) => setConta(e.target.value)} /><input className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2" placeholder="Descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} /><select className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2" value={forma} onChange={(e) => setForma(e.target.value)}><option value="todos">Todas as formas</option>{data.forms.map((f) => <option key={f}>{f}</option>)}</select>{profile.role === "admin" && <select className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2" value={data.adminSetor} onChange={(e) => data.setAdminSetor(e.target.value)}><option value="todos">Todos os setores</option>{SETORES.map((s) => <option key={s}>{s}</option>)}</select>}{profile.role === "admin" && <select className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2" value={data.adminUser} onChange={(e) => data.setAdminUser(e.target.value)}><option value="todos">Todos os usuarios</option>{data.users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select>}</div></Card>

    <div className="grid gap-3 md:grid-cols-5"><Card className="p-4"><p className="text-xs text-slate-700 dark:text-slate-300">Total analitico</p><p className="mt-2 text-lg font-semibold tabular">{formatBRL(total)}</p></Card><Card className="p-4"><p className="text-xs text-slate-700 dark:text-slate-300">Qtd. lancamentos</p><p className="mt-2 text-lg font-semibold tabular">{sortedAnalytical.length}</p></Card><Card className="p-4"><p className="text-xs text-slate-700 dark:text-slate-300">Conta com maior valor</p><p className="mt-2 text-sm font-semibold">{sortedAnalytical[0]?.conta ?? "—"}</p></Card><Card className="p-4"><p className="text-xs text-slate-700 dark:text-slate-300">Forma mais recorrente</p><p className="mt-2 text-sm font-semibold">{(Object.entries(sortedAnalytical.reduce((a,r)=>{a[r.forma]=(a[r.forma]??0)+1;return a;},{} as Record<string,number>)) as Array<[string, number]>).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? "—"}</p></Card><Card className="p-4"><p className="text-xs text-slate-700 dark:text-slate-300">Mes com maior movimentacao</p><p className="mt-2 text-sm font-semibold">{[...byMonth].sort((a,b)=>b.total-a.total)[0]?.mes ?? "—"}</p></Card></div>

    <div className="grid gap-3 md:grid-cols-2"><Card className="p-4"><h3 className="mb-2 font-semibold">Evolucao mensal dos lancamentos</h3><div className="h-[260px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={byMonth}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" /><YAxis /><Tooltip formatter={(v)=>formatBRL(Number(v ?? 0))} /><Bar dataKey="total" fill="#15803d" isAnimationActive /></BarChart></ResponsiveContainer></div></Card><Card className="p-4"><h3 className="mb-2 font-semibold">Total por forma</h3><div className="h-[260px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={byForma} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} isAnimationActive>{byForma.map((_, idx) => <Cell key={`forma-color-${idx}`} fill={pieColors[idx % pieColors.length]} />)}</Pie><Tooltip formatter={(v)=>formatBRL(Number(v ?? 0))} /></PieChart></ResponsiveContainer></div></Card></div>

    <Card className="overflow-auto"><table className="w-full text-sm"><thead className="bg-slate-50 dark:bg-slate-800"><tr><th className="px-3 py-2 text-left">Conta</th><th className="px-3 py-2 text-left">Descricao</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2 text-left">Forma</th><th className="px-3 py-2 text-left">Mes</th>{profile.role === "admin" && <th className="px-3 py-2 text-left">Setor</th>}</tr></thead><tbody>{paginated.map((r, idx) => <tr key={`${r.recordId ?? `${r.conta}-${r.mes}-${idx}`}`} className="border-t border-[var(--border)]"><td className="px-3 py-2">{r.conta}</td><td className="px-3 py-2">{r.descricao}</td><td className="px-3 py-2 text-right tabular">{formatBRL(r.valor)}</td><td className="px-3 py-2">{r.forma}</td><td className="px-3 py-2">{r.mes}</td>{profile.role === "admin" && <td className="px-3 py-2">{r.setor ?? "—"}</td>}</tr>)}</tbody></table><div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-2 text-sm"><span>Pagina {Math.min(page, totalPages)} de {totalPages} - {sortedAnalytical.length} registros</span><div className="flex gap-2"><Button className="border border-[var(--border)] text-[var(--text)] bg-[var(--card)]" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Anterior</Button><Button className="border border-[var(--border)] text-[var(--text)] bg-[var(--card)]" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Proxima</Button></div></div></Card>
  </div>;
}
