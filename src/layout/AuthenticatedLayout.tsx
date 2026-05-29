import { FileText, List, LogOut, Moon, Sun } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";

export function AuthenticatedLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  const item = (to: string, label: string, icon: ReactNode) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center rounded-lg text-sm ${
          collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2"
        } ${
          isActive
            ? "bg-slate-200 text-[var(--text)] dark:bg-slate-700"
            : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        }`
      }
    >
      {icon}
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <aside className={`fixed left-0 top-0 h-screen border-r border-[var(--border)] bg-[var(--card)] p-2 transition-all ${collapsed ? "w-16" : "w-36"}`}>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="mb-4 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 text-xs text-[var(--text)] hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Expandir ou retrair menu"
        >
          {collapsed ? ">>" : "<<"}
        </button>
        <div className="mb-4 px-2">
          {!collapsed && <>
            <p className="text-sm font-semibold">{profile?.full_name}</p>
            <p className="text-xs text-slate-700 dark:text-slate-300">{profile?.setor} • {profile?.role}</p>
          </>}
        </div>
        <nav className="space-y-1">
          {item("/sintetico", "Sintético", <FileText size={16} />)}
          {item("/analitico", "Analítico", <List size={16} />)}
        </nav>
        <div className={`absolute bottom-3 left-2 right-2 space-y-2`}>
          <button
            onClick={toggleTheme}
            className="flex w-full items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Alternar tema"
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            
          </button>
          <button
            onClick={async () => { await logout(); navigate("/login", { replace: true }); }}
            className={`flex w-full items-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] hover:bg-slate-100 dark:hover:bg-slate-800 ${collapsed ? "justify-center" : "gap-3"}`}
            aria-label="Sair"
          >
            <LogOut size={16} />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>
      <main className={`${collapsed ? "ml-16" : "ml-36"} p-0 transition-all`}>
        <Outlet />
      </main>
    </div>
  );
}



