import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SETORES } from "../lib/constants";
import { signUp } from "../lib/auth";

export function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setor, setSetor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Senha e confirmação não conferem.");
      return;
    }
    if (!setor) {
      setError("Setor é obrigatório.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signUp({ fullName, email, password, setor: setor as (typeof SETORES)[number] });
      navigate("/login", { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4"><div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm"><h1 className="text-2xl font-bold">Criar conta</h1><form onSubmit={onSubmit} className="mt-6 space-y-3"><input className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2" placeholder="Nome completo" value={fullName} onChange={(e) => setFullName(e.target.value)} required /><input className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2" placeholder="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /><select className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2" value={setor} onChange={(e) => setSetor(e.target.value)} required><option value="">Selecione o setor</option>{SETORES.map((s) => <option key={s} value={s}>{s}</option>)}</select><input className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2" placeholder="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /><input className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2" placeholder="Confirmação de senha" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />{error && <p className="text-sm text-red-600">{error}</p>}<button disabled={loading} className="w-full rounded-xl bg-green-700 px-4 py-2 font-semibold text-white">{loading ? "Criando conta..." : "Criar conta"}</button></form><div className="mt-4 text-sm"><Link to="/login" className="text-green-700">Já tenho conta</Link></div></div></div>;
}



