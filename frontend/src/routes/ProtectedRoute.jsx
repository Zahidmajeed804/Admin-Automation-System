import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PageLoader from "../components/common/PageLoader";

/**
 * Wraps a set of routes so they require authentication. Pass `permission`
 * to also require a specific permission (frontend UX only — the backend
 * independently re-checks the same permission on every request).
 */
export default function ProtectedRoute({ permission }) {
  const { isAuthenticated, loading, hasPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageLoader label="Loading your session…" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
