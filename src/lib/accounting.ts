import * as XLSX from "xlsx";
import type { AnalyticalRow, SyntheticRow } from "./types";

const monthMap: Record<string, string> = {
  jan: "01", janeiro: "01", fev: "02", fevereiro: "02", mar: "03", marco: "03", "março": "03", abr: "04", abril: "04", mai: "05", maio: "05", jun: "06", junho: "06", jul: "07", julho: "07", ago: "08", agosto: "08", set: "09", setembro: "09", out: "10", outubro: "10", nov: "11", novembro: "11", dez: "12", dezembro: "12",
};

const SHEET_ALIASES = {
  synthetic: ["sintetico", "sintético", "resumo", "consolidado"],
  analytic: ["analitico", "analítico", "detalhado", "lancamentos", "lançamentos"],
};

const aliases = {
  conta: ["conta", "codigo", "codigo da conta", "codigo_conta", "codigo_conta_financeira"],
  descricao: ["descricao", "descrição", "nome", "nome da conta", "nome_conta"],
  total: ["total", "valor total", "total_periodo"],
  valor: ["valor", "valor lancamento", "valor lançamento", "valor_lancamento"],
  grupo: ["grupo", "grupo da conta", "grupo_conta"],
  forma: ["forma", "tipo", "tipo de lançamento", "tipo de lancamento", "categoria", "forma mes", "forma mês"],
  mes: ["mes", "mês", "competencia", "competência"],
};

export const normalizeText = (v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ");
const normalizeHeader = (v: string) => normalizeText(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export const normalizeContaForCompare = (value: unknown) => normalizeText(value).replace(/^\[|\]$/g, "").trim().toLowerCase();

export const parseCurrencyBR = (value: unknown): number => {
  if (typeof value === "number") return value;
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const clean = raw.replace(/R\$/gi, "").replace(/\s/g, "");
  const hasComma = clean.includes(",");
  const normalized = hasComma ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

export const formatBRL = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

export const normalizeCompetencia = (input: unknown): string | null => {
  // Excel serial date (e.g. 46054) -> YYYY-MM
  if (typeof input === "number" && Number.isFinite(input) && input > 20000) {
    const parsed = XLSX.SSF.parse_date_code(input);
    if (parsed?.y && parsed?.m) {
      return `${String(parsed.y)}-${String(parsed.m).padStart(2, "0")}`;
    }
  }

  const s = normalizeText(input).toLowerCase();
  if (!s) return null;

  if (/^\d{5,6}$/.test(s)) {
    const asNumber = Number(s);
    if (Number.isFinite(asNumber) && asNumber > 20000) {
      const parsed = XLSX.SSF.parse_date_code(asNumber);
      if (parsed?.y && parsed?.m) {
        return `${String(parsed.y)}-${String(parsed.m).padStart(2, "0")}`;
      }
    }
  }

  const digitsOnly = s.replace(/\D/g, "");

  // ddmmaaaa -> yyyy-mm
  if (/^\d{8}$/.test(digitsOnly)) {
    const dd = digitsOnly.slice(0, 2);
    const mm = digitsOnly.slice(2, 4);
    const yyyy = digitsOnly.slice(4, 8);
    const day = Number(dd);
    const month = Number(mm);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) return `${yyyy}-${mm}`;
  }

  const m1 = s.match(/^(\d{2})\/(\d{4})$/);
  if (m1) return `${m1[2]}-${m1[1]}`;
  const m2 = s.match(/^(\d{4})-(\d{2})$/);
  if (m2) return `${m2[1]}-${m2[2]}`;
  const m2b = s.match(/^(\d{2})-(\d{4})$/);
  if (m2b) return `${m2b[2]}-${m2b[1]}`;
  const m2c = s.match(/^(\d{2})\/(\d{2})$/);
  if (m2c) return `20${m2c[2]}-${m2c[1]}`;
  const m2d = s.match(/^(\d{2})-(\d{2})$/);
  if (m2d) return `20${m2d[2]}-${m2d[1]}`;
  const m3 = s.match(/^([a-zçãé]+)\/(\d{4})$/);
  if (m3 && monthMap[m3[1]]) return `${m3[2]}-${monthMap[m3[1]]}`;
  const m4 = s.match(/^([a-zçãé]+)\/(\d{2})$/);
  if (m4 && monthMap[m4[1]]) return `20${m4[2]}-${monthMap[m4[1]]}`;
  return null;
};

function findHeader(headers: string[], candidates: string[]) {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  for (const c of candidates) {
    const wanted = normalizeHeader(c);
    const found = normalized.find((h) => h.norm === wanted);
    if (found) return found.raw;
  }
  return null;
}

function normalizeSheetName(name: string) {
  return normalizeHeader(name);
}

function isAllowedSheet(name: string, kind: "synthetic" | "analytic") {
  const n = normalizeSheetName(name);
  return SHEET_ALIASES[kind].includes(n);
}

export function parseXlsxTwoSheets(file: File): Promise<{ syntheticRows: SyntheticRow[]; analyticalRows: AnalyticalRow[]; months: string[]; groups: string[]; forms: string[]; }>
{
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wb = XLSX.read(reader.result, { type: "binary" });
        if (wb.SheetNames.length < 2) return reject(new Error("Arquivo inválido: é obrigatório possuir duas abas (Sintético e Analítico)."));

        const s1 = wb.SheetNames[0];
        const s2 = wb.SheetNames[1];
        if (!isAllowedSheet(s1, "synthetic")) return reject(new Error("A primeira aba deve ser Sintético (ou equivalente: Sintetico/Resumo/Consolidado)."));
        if (!isAllowedSheet(s2, "analytic")) return reject(new Error("A segunda aba deve ser Analítico (ou equivalente: Analitico/Detalhado/Lançamentos)."));

        const syntheticJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[s1], { defval: "" });
        const analyticJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[s2], { defval: "" });

        const sh = Object.keys(syntheticJson[0] ?? {});
        const ah = Object.keys(analyticJson[0] ?? {});

        const sConta = findHeader(sh, aliases.conta);
        const sDescricao = findHeader(sh, aliases.descricao);
        const sTotal = findHeader(sh, aliases.total);
        const sGrupo = findHeader(sh, aliases.grupo);
        const sMes = findHeader(sh, aliases.mes);

        const aConta = findHeader(ah, aliases.conta);
        const aDescricao = findHeader(ah, aliases.descricao);
        const aValor = findHeader(ah, aliases.valor);
        const aForma = findHeader(ah, aliases.forma);
        const aMes = findHeader(ah, aliases.mes);

        const missingSynthetic: string[] = [];
        if (!sConta) missingSynthetic.push("Conta");
        if (!sDescricao) missingSynthetic.push("Descrição");
        if (!sTotal) missingSynthetic.push("Total");
        if (!sGrupo) missingSynthetic.push("Grupo");
        if (!sMes) missingSynthetic.push("Mês");
        if (missingSynthetic.length) return reject(new Error(`Aba Sintético com colunas ausentes: ${missingSynthetic.join(", ")}`));

        const missingAnalytic: string[] = [];
        if (!aConta) missingAnalytic.push("Conta");
        if (!aDescricao) missingAnalytic.push("Descrição");
        if (!aValor) missingAnalytic.push("Valor");
        if (!aForma) missingAnalytic.push("Forma");
        if (missingAnalytic.length) return reject(new Error(`Aba Analítico com colunas ausentes: ${missingAnalytic.join(", ")}`));

        const syntheticRows: SyntheticRow[] = [];
        syntheticJson.forEach((r) => {
          if (Object.values(r).every((v) => normalizeText(v) === "")) return;
          const conta = normalizeText(sConta ? r[sConta] : "");
          const mes = normalizeCompetencia(sMes ? r[sMes] : "");
          if (!conta || !mes) return;
          syntheticRows.push({
            conta,
            descricao: normalizeText(sDescricao ? r[sDescricao] : "") || "Sem descrição",
            total: parseCurrencyBR(sTotal ? r[sTotal] : 0),
            grupo: normalizeText(sGrupo ? r[sGrupo] : "") || "Não informado",
            mes,
          });
        });

        const syntheticMonthsByConta = syntheticRows.reduce((acc, row) => {
          const set = acc.get(row.conta) ?? new Set<string>();
          set.add(row.mes);
          acc.set(row.conta, set);
          return acc;
        }, new Map<string, Set<string>>());
        const syntheticMonthsByContaDescricao = syntheticRows.reduce((acc, row) => {
          const key = `${row.conta}::${row.descricao}`;
          const set = acc.get(key) ?? new Set<string>();
          set.add(row.mes);
          acc.set(key, set);
          return acc;
        }, new Map<string, Set<string>>());
        const singleSyntheticMonth = Array.from(new Set(syntheticRows.map((r) => r.mes)));

        const analyticalRows: AnalyticalRow[] = [];
        analyticJson.forEach((r) => {
          if (Object.values(r).every((v) => normalizeText(v) === "")) return;
          const conta = normalizeText(aConta ? r[aConta] : "");
          const descricao = normalizeText(aDescricao ? r[aDescricao] : "") || "Sem descrição";
          const mesParsed = normalizeCompetencia(aMes ? r[aMes] : "");
          let mes = mesParsed;
          if (!mes) {
            const byContaDesc = syntheticMonthsByContaDescricao.get(`${conta}::${descricao}`);
            if (byContaDesc && byContaDesc.size === 1) {
              mes = Array.from(byContaDesc)[0];
            }
          }
          if (!mes) {
            const contaMonths = syntheticMonthsByConta.get(conta);
            if (contaMonths && contaMonths.size === 1) {
              mes = Array.from(contaMonths)[0];
            } else if (singleSyntheticMonth.length === 1) {
              mes = singleSyntheticMonth[0];
            }
          }
          if (!conta || !mes) return;
          analyticalRows.push({
            conta,
            descricao,
            valor: parseCurrencyBR(aValor ? r[aValor] : 0),
            forma: normalizeText(aForma ? r[aForma] : "") || "Não informado",
            mes,
          });
        });

        if (analyticalRows.length === 0 && analyticJson.length > 0) {
          return reject(new Error("Aba Analítico sem mês válido. Preencha Mês ou garanta vínculo claro com o Sintético por Conta."));
        }

        resolve({
          syntheticRows,
          analyticalRows,
          months: Array.from(new Set([...syntheticRows.map((r) => r.mes), ...analyticalRows.map((r) => r.mes)])).sort(),
          groups: Array.from(new Set(syntheticRows.map((r) => r.grupo))).sort((a, b) => a.localeCompare(b)),
          forms: Array.from(new Set(analyticalRows.map((r) => r.forma))).sort((a, b) => a.localeCompare(b)),
        });
      } catch {
        reject(new Error("Falha ao ler o arquivo XLSX."));
      }
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsBinaryString(file);
  });
}

export function buildSyntheticFromAnalytical(rows: AnalyticalRow[]): SyntheticRow[] {
  const map = new Map<string, SyntheticRow>();
  rows.forEach((r) => {
    const key = `${r.conta}::${r.descricao}::${r.mes}`;
    const prev = map.get(key);
    map.set(key, { conta: r.conta, descricao: r.descricao, total: (prev?.total ?? 0) + r.valor, grupo: "Não informado", mes: r.mes });
  });
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export function calculateInconsistencies(syntheticRows: SyntheticRow[], analyticalRows: AnalyticalRow[]) {
  const sumAnalytic = new Map<string, number>();
  analyticalRows.forEach((r) => {
    const key = `${r.conta}::${r.mes}`;
    sumAnalytic.set(key, (sumAnalytic.get(key) ?? 0) + r.valor);
  });

  return syntheticRows.map((s) => {
    const key = `${s.conta}::${s.mes}`;
    const analyticTotal = sumAnalytic.get(key);
    if (analyticTotal === undefined) {
      return { conta: s.conta, mes: s.mes, descricao: s.descricao, syntheticTotal: s.total, analyticTotal: 0, diff: s.total, status: "Sem analítico" as const };
    }
    const diff = s.total - analyticTotal;
    return { conta: s.conta, mes: s.mes, descricao: s.descricao, syntheticTotal: s.total, analyticTotal, diff, status: Math.abs(diff) < 0.005 ? "OK" as const : "Divergente" as const };
  });
}

export function exportTemplateXlsx() {
  const wb = XLSX.utils.book_new();

  const wsSynthetic = XLSX.utils.aoa_to_sheet([
    ["Conta", "Descrição", "Total", "Grupo", "Mês"],
    ["1001", "Receita Operacional", "400,00", "Receitas", "01/2026"],
    ["2001", "Despesa Administrativa", "150,00", "Despesas", "01/2026"],
  ]);
  XLSX.utils.book_append_sheet(wb, wsSynthetic, "Sintético");

  const wsAnalytic = XLSX.utils.aoa_to_sheet([
    ["Conta", "Descrição", "Valor", "Forma", "Mês"],
    ["1001", "Receita Operacional", "100,00", "Boleto", "01/2026"],
    ["1001", "Receita Operacional", "300,00", "Cartão", "01/2026"],
    ["2001", "Despesa Administrativa", "150,00", "Transferência", "01/2026"],
  ]);
  XLSX.utils.book_append_sheet(wb, wsAnalytic, "Analítico");

  XLSX.writeFile(wb, "modelo_contabilidade_estrategica_duas_abas.xlsx");
}

export function exportViewToXlsx(params: { sintetico: SyntheticRow[]; analitico: AnalyticalRow[]; fileName: string }) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(params.sintetico.map((r) => ({ Conta: r.conta, Descricao: r.descricao, Total: r.total, Grupo: r.grupo, Mes: r.mes }))), "Sintetico");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(params.analitico.map((r) => ({ Conta: r.conta, Descricao: r.descricao, Valor: r.valor, Forma: r.forma, Mes: r.mes }))), "Analitico");

  const byGroup = Object.entries(params.sintetico.reduce((acc, r) => { acc[r.grupo] = (acc[r.grupo] ?? 0) + r.total; return acc; }, {} as Record<string, number>)).map(([grupo, total]) => ({ Grupo: grupo, Total: total }));
  const byMonth = Object.entries(params.analitico.reduce((acc, r) => { acc[r.mes] = (acc[r.mes] ?? 0) + r.valor; return acc; }, {} as Record<string, number>)).map(([mes, total]) => ({ Mes: mes, Total: total })).sort((a, b) => a.Mes.localeCompare(b.Mes));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(byGroup), "Resumo por Grupo");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(byMonth), "Resumo por Mes");

  XLSX.writeFile(wb, params.fileName);
}
