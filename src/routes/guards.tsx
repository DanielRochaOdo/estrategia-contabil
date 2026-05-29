import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function ProtectedRoute() {
  const { user, loading, profileError } = useAuth();
  const location = useLocation();

  if (loading) return <div className="p-8">Carregando sessão...</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (profileError) return <div className="p-8 text-red-600">{profileError}</div>;
  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">Carregando...</div>;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function AdminRoute() {
  const { profile, loading } = useAuth();
  if (loading) return <div className="p-8">Carregando...</div>;
  if (!profile || profile.role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}
