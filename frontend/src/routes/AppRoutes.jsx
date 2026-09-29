import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import ProtectedRoute from "./ProtectedRoute";
import PageLoader from "../components/common/PageLoader";

import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import UnauthorizedPage from "../pages/UnauthorizedPage";

// Lazy-loaded: each authenticated page becomes its own chunk instead of all
// being bundled into one JS file, so switching pages fetches only what that
// page needs rather than re-downloading/parsing the whole app up front.
const DashboardPage = lazy(() => import("../pages/dashboard/DashboardPage"));
const GiveawaysPage = lazy(() => import("../pages/giveaways/GiveawaysPage"));
const InventoryPage = lazy(() => import("../pages/inventory/InventoryPage"));
const GeneratorLayout = lazy(() => import("../pages/generator/GeneratorLayout"));
const GeneratorPage = lazy(() => import("../pages/generator/GeneratorPage"));
const GeneratorLogsPage = lazy(() => import("../pages/generator/GeneratorLogsPage"));
const GeneratorMaintenancePage = lazy(() => import("../pages/generator/GeneratorMaintenancePage"));
const GeneratorReportsPage = lazy(() => import("../pages/generator/GeneratorReportsPage"));
const AttendancePage = lazy(() => import("../pages/attendance/AttendancePage"));
const OvertimePage = lazy(() => import("../pages/overtime/OvertimePage"));
const LeavePage = lazy(() => import("../pages/leave/LeavePage"));
const StaffPage = lazy(() => import("../pages/attendance/StaffPage"));
const ReportsPage = lazy(() => import("../pages/reports/ReportsPage"));
const NotificationsPage = lazy(() => import("../pages/notifications/NotificationsPage"));
const ProfilePage = lazy(() => import("../pages/profile/ProfilePage"));
const SettingsPage = lazy(() => import("../pages/settings/SettingsPage"));
const NotFoundPage = lazy(() => import("../pages/NotFoundPage"));

/**
 * Central route map. Public routes (login/register/unauthorized) sit
 * outside ProtectedRoute; everything else requires a valid session.
 * Per-module permission gates (e.g. permission="giveaways.read") get added
 * to individual routes as each module ships.
 */
export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader label="Loading…" />}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/giveaways" element={<GiveawaysPage />} />
            <Route path="/giveaways/new" element={<GiveawaysPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/inventory/new" element={<InventoryPage />} />
            <Route path="/generator" element={<GeneratorLayout />}>
              <Route index element={<GeneratorPage />} />
              <Route path="logs" element={<GeneratorLogsPage />} />
              <Route path="maintenance" element={<GeneratorMaintenancePage />} />
              <Route element={<ProtectedRoute permission="reports.read" />}>
                <Route path="reports" element={<GeneratorReportsPage />} />
              </Route>
            </Route>
            <Route element={<ProtectedRoute permission="attendance.read" />}>
              <Route path="/attendance" element={<AttendancePage />} />
            </Route>
            <Route element={<ProtectedRoute permission="overtime.read" />}>
              <Route path="/attendance/overtime" element={<OvertimePage />} />
            </Route>
            <Route element={<ProtectedRoute permission="leave.read" />}>
              <Route path="/attendance/leave" element={<LeavePage />} />
            </Route>
            <Route element={<ProtectedRoute permission="users.manage" />}>
              <Route path="/attendance/staff" element={<StaffPage />} />
            </Route>
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
