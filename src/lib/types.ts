export type AnalyticalRow = {
  conta: string;
  descricao: string;
  valor: number;
  forma: string;
  mes: string;
};

export type SyntheticRow = {
  conta: string;
  descricao: string;
  total: number;
  grupo: string;
  mes: string;
};

export type SyntheticStatus = "OK" | "Divergente" | "Sem analítico";

export type ViewType = "sintetico" | "analitico";
