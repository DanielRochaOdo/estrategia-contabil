export const SETORES = [
  "ASSESSORIA ESTRATÉGICA",
  "TI",
  "ADMINISTRATIVO",
  "DIRETORIA",
  "DEPARTAMENTO PESSOAL",
  "RH",
  "MARKETING",
] as const;

export type Setor = (typeof SETORES)[number];
