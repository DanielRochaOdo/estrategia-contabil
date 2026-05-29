import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { ProtectedRoute, PublicOnlyRoute } from "./routes/guards";
import { AuthenticatedLayout } from "./layout/AuthenticatedLayout";
import { SyntheticPage } from "./components/dashboard/SyntheticPage";
import { AnalyticalPage } from "./components/dashboard/AnalyticalPage";

function SyntheticRoute() {
  const { profile } = useAuth();
  if (!profile) return <div className="p-8">Perfil não encontrado.</div>;
  return <SyntheticPage profile={profile} />;
}

function AnalyticalRoute() {
  const { profile } = useAuth();
  if (!profile) return <div className="p-8">Perfil não encontrado.</div>;
  return <AnalyticalPage profile={profile} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route element={<AuthenticatedLayout />}>
                <Route path="/" element={<Navigate to="/sintetico" replace />} />
                <Route path="/sintetico" element={<SyntheticRoute />} />
                <Route path="/analitico" element={<AnalyticalRoute />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
