import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signIn } from "../lib/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4"><div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm"><h1 className="text-2xl font-bold">Contabilidade Estratégica</h1><p className="mt-2 text-sm text-slate-700 dark:text-slate-300">Plataforma para análise estratégica de contas financeiras, permitindo comparação mensal, visão horizontal no padrão DRE, ranking de contas, acompanhamento por setor e tomada de decisão baseada em dados.</p><form onSubmit={onSubmit} className="mt-6 space-y-3"><input className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2" placeholder="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /><input className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2" placeholder="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />{error && <p className="text-sm text-red-600">{error}</p>}<button disabled={loading} className="w-full rounded-xl bg-green-700 px-4 py-2 font-semibold text-white">{loading ? "Entrando..." : "Entrar"}</button></form><div className="mt-4 flex justify-between text-sm"><Link to="/signup" className="text-green-700">Criar conta</Link><span className="text-slate-700 dark:text-slate-300">Esqueci minha senha</span></div></div></div>;
}



