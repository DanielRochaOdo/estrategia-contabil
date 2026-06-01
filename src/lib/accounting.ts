import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import type { AnalyticalRow, SyntheticRow } from "./types";

const monthMap: Record<string, string> = {
  jan: "01", janeiro: "01", fev: "02", fevereiro: "02", mar: "03", marco: "03", abr: "04", abril: "04", mai: "05", maio: "05", jun: "06", junho: "06", jul: "07", julho: "07", ago: "08", agosto: "08", set: "09", setembro: "09", out: "10", outubro: "10", nov: "11", novembro: "11", dez: "12", dezembro: "12",
};

const SHEET_ALIASES = {
  synthetic: ["sintetico", "sint�tico", "resumo", "consolidado"],
  analytic: ["analitico", "anal�tico", "detalhado", "lancamentos", "lan�amentos"],
};

const aliases = {
  conta: ["conta", "codigo", "codigo da conta", "codigo_conta", "codigo_conta_financeira"],
  descricao: ["descricao", "descri��o", "nome", "nome da conta", "nome_conta"],
  total: ["total", "valor total", "total_periodo"],
  valor: ["valor", "valor lancamento", "valor lan�amento", "valor_lancamento"],
  grupo: ["grupo", "grupo da conta", "grupo_conta"],
  forma: ["forma", "tipo", "tipo de lan�amento", "tipo de lancamento", "categoria", "forma mes", "forma m�s"],
  mes: ["mes", "m�s", "competencia", "compet�ncia"],
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
  const sAscii = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

  const m1 = sAscii.match(/^(\d{2})\/(\d{4})$/);
  if (m1) return `${m1[2]}-${m1[1]}`;
  const m2 = sAscii.match(/^(\d{4})-(\d{2})$/);
  if (m2) return `${m2[1]}-${m2[2]}`;
  const m2b = sAscii.match(/^(\d{2})-(\d{4})$/);
  if (m2b) return `${m2b[2]}-${m2b[1]}`;
  const m2c = sAscii.match(/^(\d{2})\/(\d{2})$/);
  if (m2c) return `20${m2c[2]}-${m2c[1]}`;
  const m2d = sAscii.match(/^(\d{2})-(\d{2})$/);
  if (m2d) return `20${m2d[2]}-${m2d[1]}`;
  const m3 = sAscii.match(/^([a-z]+)\/(\d{4})$/);
  if (m3 && monthMap[m3[1]]) return `${m3[2]}-${monthMap[m3[1]]}`;
  const m4 = sAscii.match(/^([a-z]+)\/(\d{2})$/);
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
        if (wb.SheetNames.length < 2) return reject(new Error("Arquivo inv�lido: � obrigat�rio possuir duas abas (Sint�tico e Anal�tico)."));

        const s1 = wb.SheetNames[0];
        const s2 = wb.SheetNames[1];
        if (!isAllowedSheet(s1, "synthetic")) return reject(new Error("A primeira aba deve ser Sint�tico (ou equivalente: Sintetico/Resumo/Consolidado)."));
        if (!isAllowedSheet(s2, "analytic")) return reject(new Error("A segunda aba deve ser Anal�tico (ou equivalente: Analitico/Detalhado/Lan�amentos)."));

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
        if (!sDescricao) missingSynthetic.push("Descri��o");
        if (!sTotal) missingSynthetic.push("Total");
        if (!sGrupo) missingSynthetic.push("Grupo");
        if (!sMes) missingSynthetic.push("M�s");
        if (missingSynthetic.length) return reject(new Error(`Aba Sint�tico com colunas ausentes: ${missingSynthetic.join(", ")}`));

        const missingAnalytic: string[] = [];
        if (!aConta) missingAnalytic.push("Conta");
        if (!aDescricao) missingAnalytic.push("Descri��o");
        if (!aValor) missingAnalytic.push("Valor");
        if (!aForma) missingAnalytic.push("Forma");
        if (missingAnalytic.length) return reject(new Error(`Aba Anal�tico com colunas ausentes: ${missingAnalytic.join(", ")}`));

        const syntheticRows: SyntheticRow[] = [];
        syntheticJson.forEach((r) => {
          if (Object.values(r).every((v) => normalizeText(v) === "")) return;
          const conta = normalizeText(sConta ? r[sConta] : "");
          const mes = normalizeCompetencia(sMes ? r[sMes] : "");
          if (!conta || !mes) return;
          syntheticRows.push({
            conta,
            descricao: normalizeText(sDescricao ? r[sDescricao] : "") || "Sem descri��o",
            total: parseCurrencyBR(sTotal ? r[sTotal] : 0),
            grupo: normalizeText(sGrupo ? r[sGrupo] : "") || "N�o informado",
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
          const descricao = normalizeText(aDescricao ? r[aDescricao] : "") || "Sem descri��o";
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
            forma: normalizeText(aForma ? r[aForma] : "") || "N�o informado",
            mes,
          });
        });

        if (analyticalRows.length === 0 && analyticJson.length > 0) {
          return reject(new Error("Aba Anal�tico sem m�s v�lido. Preencha M�s ou garanta v�nculo claro com o Sint�tico por Conta."));
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
    reader.onerror = () => reject(new Error("N�o foi poss�vel ler o arquivo."));
    reader.readAsBinaryString(file);
  });
}

export function buildSyntheticFromAnalytical(rows: AnalyticalRow[]): SyntheticRow[] {
  const map = new Map<string, SyntheticRow>();
  rows.forEach((r) => {
    const key = `${r.conta}::${r.descricao}::${r.mes}`;
    const prev = map.get(key);
    map.set(key, { conta: r.conta, descricao: r.descricao, total: (prev?.total ?? 0) + r.valor, grupo: "N�o informado", mes: r.mes });
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
      return { conta: s.conta, mes: s.mes, descricao: s.descricao, syntheticTotal: s.total, analyticTotal: 0, diff: s.total, status: "Sem anal�tico" as const };
    }
    const diff = s.total - analyticTotal;
    return { conta: s.conta, mes: s.mes, descricao: s.descricao, syntheticTotal: s.total, analyticTotal, diff, status: Math.abs(diff) < 0.005 ? "OK" as const : "Divergente" as const };
  });
}

export function exportTemplateXlsx() {
  const wb = XLSX.utils.book_new();

  const wsSynthetic = XLSX.utils.aoa_to_sheet([
    ["Conta", "Descri��o", "Total", "Grupo", "M�s"],
    ["1001", "Receita Operacional", "400,00", "Receitas", "01/2026"],
    ["2001", "Despesa Administrativa", "150,00", "Despesas", "01/2026"],
  ]);
  XLSX.utils.book_append_sheet(wb, wsSynthetic, "Sint�tico");

  const wsAnalytic = XLSX.utils.aoa_to_sheet([
    ["Conta", "Descri��o", "Valor", "Forma", "M�s"],
    ["1001", "Receita Operacional", "100,00", "Boleto", "01/2026"],
    ["1001", "Receita Operacional", "300,00", "Cart�o", "01/2026"],
    ["2001", "Despesa Administrativa", "150,00", "Transfer�ncia", "01/2026"],
  ]);
  XLSX.utils.book_append_sheet(wb, wsAnalytic, "Anal�tico");

  XLSX.writeFile(wb, "modelo_contabilidade_estrategica_duas_abas.xlsx");
}

export function exportViewToXlsx(params: { sintetico: SyntheticRow[]; analitico: AnalyticalRow[]; fileName: string }) {
  const byGroup = Object.entries(params.sintetico.reduce((acc, r) => { acc[r.grupo] = (acc[r.grupo] ?? 0) + r.total; return acc; }, {} as Record<string, number>)).map(([grupo, total]) => ({ Grupo: grupo, Total: total }));
  const byMonth = Object.entries(params.analitico.reduce((acc, r) => { acc[r.mes] = (acc[r.mes] ?? 0) + r.valor; return acc; }, {} as Record<string, number>)).map(([mes, total]) => ({ Mes: mes, Total: total })).sort((a, b) => a.Mes.localeCompare(b.Mes));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Contabilidade Estrat�gica";
  workbook.created = new Date();

  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFD1D5DB" } },
    left: { style: "thin", color: { argb: "FFD1D5DB" } },
    bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
    right: { style: "thin", color: { argb: "FFD1D5DB" } },
  };

  const addStyledSheet = (
    name: string,
    columns: Array<{ header: string; key: string; width: number; currency?: boolean }>,
    rows: Array<Record<string, string | number>>,
  ) => {
    const sheet = workbook.addWorksheet(name, {
      pageSetup: {
        margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
      },
      views: [{ state: "frozen", ySplit: 1 }],
    });

    sheet.columns = columns;
    sheet.getRow(1).height = 24;
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B6E4F" } };
    sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

    rows.forEach((row) => sheet.addRow(row));

    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = borderStyle;
        cell.alignment = { vertical: "middle", horizontal: rowNumber === 1 ? "center" : "left" };
        if (rowNumber > 1) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: rowNumber % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF" },
          };
        }
      });
    });

    columns.forEach((column, index) => {
      if (!column.currency) return;
      sheet.getColumn(index + 1).numFmt = '"R$"#,##0.00';
      sheet.getColumn(index + 1).alignment = { vertical: "middle", horizontal: "right" };
    });
  };

  addStyledSheet(
    "Sintetico",
    [
      { header: "Conta", key: "Conta", width: 18 },
      { header: "Descricao", key: "Descricao", width: 42 },
      { header: "Total", key: "Total", width: 16, currency: true },
      { header: "Grupo", key: "Grupo", width: 26 },
      { header: "Mes", key: "Mes", width: 14 },
    ],
    params.sintetico.map((r) => ({ Conta: r.conta, Descricao: r.descricao, Total: r.total, Grupo: r.grupo, Mes: r.mes })),
  );

  addStyledSheet(
    "Analitico",
    [
      { header: "Conta", key: "Conta", width: 18 },
      { header: "Descricao", key: "Descricao", width: 42 },
      { header: "Valor", key: "Valor", width: 16, currency: true },
      { header: "Forma", key: "Forma", width: 24 },
      { header: "Mes", key: "Mes", width: 14 },
    ],
    params.analitico.map((r) => ({ Conta: r.conta, Descricao: r.descricao, Valor: r.valor, Forma: r.forma, Mes: r.mes })),
  );

  addStyledSheet(
    "Resumo por Grupo",
    [
      { header: "Grupo", key: "Grupo", width: 30 },
      { header: "Total", key: "Total", width: 18, currency: true },
    ],
    byGroup,
  );

  addStyledSheet(
    "Resumo por Mes",
    [
      { header: "Mes", key: "Mes", width: 14 },
      { header: "Total", key: "Total", width: 18, currency: true },
    ],
    byMonth,
  );

  void workbook.xlsx.writeBuffer().then((buffer) => {
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = params.fileName.endsWith(".xlsx") ? params.fileName : `${params.fileName}.xlsx`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  });
}



