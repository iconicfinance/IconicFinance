import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
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
const LayoutRoute = ({ children }: { children: React.ReactNode }) => (
  <AppLayout>{children}</AppLayout>
);

const App = () => (
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

            {/* Catch-All 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
