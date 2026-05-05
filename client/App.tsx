import "./global.css";
import { Component, type ReactNode } from "react";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Placeholder from "./pages/Placeholder";

// Assistant Pages
import AssistantToday from "./pages/assistant/Today";
import AssistantAddPayment from "./pages/assistant/AddPayment";
import AssistantAddExpense from "./pages/assistant/AddExpense";
import AssistantHistory from "./pages/assistant/History";
import AssistantPatients from "./pages/assistant/Patients";

// Doctor Pages
import DoctorDashboard from "./pages/doctor/Dashboard";
import DoctorPatients from "./pages/doctor/Patients";

// Admin Pages
import AdminDashboard from "./pages/admin/Dashboard";
import AdminDoctors from "./pages/admin/Doctors";
import AdminUsers from "./pages/admin/Users";
import AdminMonthlyClosure from "./pages/admin/MonthlyClosure";
import AdminPatientDetail from "./pages/admin/PatientDetail";
import AdminLabConfig from "./pages/admin/LabConfig";
import AdminPatients from "./pages/admin/AdminPatients";

const queryClient = new QueryClient();

// Root redirect component
const RootRedirect = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to role-specific dashboard
  if (user?.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  } else if (user?.role === 'doctor') {
    return <Navigate to="/doctor/dashboard" replace />;
  } else if (user?.role === 'assistant') {
    return <Navigate to="/assistant/today" replace />;
  }

  return <Navigate to="/login" replace />;
};

// Layout wrapper for protected routes
const LayoutRoute = ({ children }: { children: ReactNode }) => (
  <AppLayout>{children}</AppLayout>
);

const App = () => (
  <LanguageProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />

            {/* Root redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* Shared routes — accessible to all roles */}
            <Route
              path="/add-payment"
              element={
                <ProtectedRoute allowedRoles={["admin", "doctor", "assistant"]}>
                  <LayoutRoute>
                    <AssistantAddPayment />
                  </LayoutRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/add-expense"
              element={
                <ProtectedRoute allowedRoles={["admin", "doctor", "assistant"]}>
                  <LayoutRoute>
                    <AssistantAddExpense />
                  </LayoutRoute>
                </ProtectedRoute>
              }
            />

            {/* Assistant Routes */}
            <Route
              path="/assistant/today"
              element={
                <ProtectedRoute allowedRoles={["assistant"]}>
                  <LayoutRoute>
                    <AssistantToday />
                  </LayoutRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/assistant/add-payment"
              element={
                <ProtectedRoute allowedRoles={["assistant"]}>
                  <LayoutRoute>
                    <AssistantAddPayment />
                  </LayoutRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/assistant/add-expense"
              element={
                <ProtectedRoute allowedRoles={["assistant"]}>
                  <LayoutRoute>
                    <AssistantAddExpense />
                  </LayoutRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/assistant/history"
              element={
                <ProtectedRoute allowedRoles={["assistant"]}>
                  <LayoutRoute>
                    <AssistantHistory />
                  </LayoutRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/assistant/patients"
              element={
                <ProtectedRoute allowedRoles={["assistant"]}>
                  <LayoutRoute>
                    <AssistantPatients />
                  </LayoutRoute>
                </ProtectedRoute>
              }
            />

            {/* Doctor Routes */}
            <Route
              path="/doctor/dashboard"
              element={
                <ProtectedRoute allowedRoles={["doctor"]}>
                  <LayoutRoute>
                    <DoctorDashboard />
                  </LayoutRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/patients"
              element={
                <ProtectedRoute allowedRoles={["doctor"]}>
                  <LayoutRoute>
                    <DoctorPatients />
                  </LayoutRoute>
                </ProtectedRoute>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <LayoutRoute>
                    <AdminDashboard />
                  </LayoutRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/doctors"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <LayoutRoute>
                    <AdminDoctors />
                  </LayoutRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <LayoutRoute>
                    <AdminUsers />
                  </LayoutRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/monthly-closing"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <LayoutRoute>
                    <AdminMonthlyClosure />
                  </LayoutRoute>
                </ProtectedRoute>
              }
            />

            {/* Admin Patient Detail */}
            <Route
              path="/admin/patients/:patientId"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <LayoutRoute>
                    <AdminPatientDetail />
                  </LayoutRoute>
                </ProtectedRoute>
              }
            />

            {/* Admin Patients Overview */}
            <Route
              path="/admin/patients"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <LayoutRoute>
                    <AdminPatients />
                  </LayoutRoute>
                </ProtectedRoute>
              }
            />

            {/* Lab Config */}
            <Route
              path="/admin/lab-config"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <LayoutRoute>
                    <AdminLabConfig />
                  </LayoutRoute>
                </ProtectedRoute>
              }
            />

            {/* Catch-All 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </LanguageProvider>
);

// ─── Error Boundary ─────────────────────────────────────────────────────────
// Catches unhandled crashes (network errors, import failures, etc.) that would
// otherwise produce a blank white screen in PWA mode.
class AppErrorBoundary extends Component<
  { children: ReactNode },
  { crashed: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { crashed: false };
  }
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  render() {
    if (this.state.crashed) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'sans-serif',
            padding: '24px',
            textAlign: 'center',
            background: '#f9fafb',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              background: '#0078a8',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>IF</span>
          </div>
          <p style={{ fontSize: 18, fontWeight: 600, color: '#111', margin: 0 }}>
            Something went wrong
          </p>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
            The app encountered an unexpected error. Please reload.
          </p>
          <button
            onClick={() => window.location.replace('/login')}
            style={{
              marginTop: 8,
              padding: '10px 24px',
              background: '#0078a8',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
