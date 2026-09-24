import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import ProtectedRoute from "./ProtectedRoute";

import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import UnauthorizedPage from "../pages/UnauthorizedPage";

import DashboardPage from "../pages/dashboard/DashboardPage";
import GiveawaysPage from "../pages/giveaways/GiveawaysPage";
import InventoryPage from "../pages/inventory/InventoryPage";
import GeneratorLayout from "../pages/generator/GeneratorLayout";
import GeneratorPage from "../pages/generator/GeneratorPage";
import GeneratorLogsPage from "../pages/generator/GeneratorLogsPage";
import AttendancePage from "../pages/attendance/AttendancePage";
import ReportsPage from "../pages/reports/ReportsPage";
import NotificationsPage from "../pages/notifications/NotificationsPage";
import ProfilePage from "../pages/profile/ProfilePage";
import SettingsPage from "../pages/settings/SettingsPage";
import NotFoundPage from "../pages/NotFoundPage";

/**
 * Central route map. Public routes (login/register/unauthorized) sit
 * outside ProtectedRoute; everything else requires a valid session.
 * Per-module permission gates (e.g. permission="giveaways.read") get added
 * to individual routes as each module ships.
 */
export default function AppRoutes() {
  return (
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
            <Route path="maintenance" element={<GeneratorPage />} />
          </Route>
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/attendance/overtime" element={<AttendancePage />} />
          <Route path="/attendance/leave" element={<AttendancePage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
