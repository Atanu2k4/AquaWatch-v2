import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { WaterDataProvider } from "./contexts/WaterDataContext";
import { LoadingScreen } from "./components/LoadingScreen";
import { Authentication } from "./components/Authentication";
import { UserDatabase } from "./components/UserDatabase";
import AdminDashboard from "./components/AdminDashboard";

import { LandingPage } from "./pages/LandingPage";
import { DevTestPage } from "./pages/DevTestPage";
import { IncidentReportPage } from "./pages/IncidentReportPage";
import { L1Dashboard } from "./pages/L1Dashboard";
import { SuperAdminDashboard } from "./pages/SuperAdminDashboard";

// ── Auth page wrapper — redirects to the right dashboard after login ──────────
const AuthPage: React.FC = () => {
  const { appRole } = useAuth();
  const navigate = useNavigate();

  // Already logged in → go to correct dashboard
  if (appRole === "superadmin") return <Navigate to="/superadmin" replace />;
  if (appRole === "l1") return <Navigate to="/l1" replace />;
  if (appRole === "admin") return <Navigate to="/admin" replace />;
  if (appRole === "user") return <Navigate to="/dashboard" replace />;

  const handleSuccess = () => {
    // Navigate after login based on role — small delay lets state settle
    setTimeout(() => {
      const role = (window as any).__aqRole;
      if (role === "superadmin") navigate("/superadmin", { replace: true });
      else if (role === "l1") navigate("/l1", { replace: true });
      else if (role === "admin") navigate("/admin", { replace: true });
      else navigate("/dashboard", { replace: true });
    }, 50);
  };

  return <Authentication onSuccess={handleSuccess} />;
};

// ── Role-gated wrapper components ─────────────────────────────────────────────
const RequireRole: React.FC<{ role: string; children: React.ReactNode }> = ({ role, children }) => {
  const { appRole, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (appRole !== role) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};




// ── Root app with single Router ───────────────────────────────────────────────
const AppRoutes: React.FC = () => {
  const { appRole, loading } = useAuth();

  // Store role on window so AuthPage's setTimeout can read the latest value
  (window as any).__aqRole = appRole;

  if (loading) return <LoadingScreen />;

  return (
    <Routes>
      {/* ── Always-public routes ─────────────────────────────────── */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/report" element={<IncidentReportPage />} />
      <Route path="/dev-test" element={<DevTestPage />} />


      {/* ── Auth page — redirects to dashboard if already logged in ── */}
      <Route path="/auth" element={<AuthPage />} />

      {/* ── Super Admin (requires superadmin role) ───────────────── */}
      <Route
        path="/superadmin"
        element={
          <RequireRole role="superadmin">
            <SuperAdminDashboard />
          </RequireRole>
        }
      />

      {/* ── L1 Authority (requires l1 role) ──────────────────────── */}
      <Route
        path="/l1"
        element={
          <RequireRole role="l1">
            <L1Dashboard />
          </RequireRole>
        }
      />

      {/* ── State Admin (requires admin role) ────────────────────── */}
      <Route
        path="/admin"
        element={
          <RequireRole role="admin">
            <WaterDataProvider>
              <AdminDashboard />
            </WaterDataProvider>
          </RequireRole>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RequireRole role="admin">
            <WaterDataProvider>
              <UserDatabase />
            </WaterDataProvider>
          </RequireRole>
        }
      />

      {/* ── Fallback: citizens go to dashboard, authorities to auth ─ */}
      <Route
        path="*"
        element={
          appRole && appRole !== "user"
            ? <Navigate to={`/${appRole}`} replace />
            : <Navigate to="/dashboard" replace />
        }
      />
    </Routes>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
