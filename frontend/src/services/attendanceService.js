import apiClient from "./apiClient";
import { cleanParams } from "../utils/cleanParams";

export const attendanceService = {
  today: () => apiClient.get("/attendance/me/today").then((r) => r.data.data.attendance),
  clockIn: () => apiClient.post("/attendance/clock-in").then((r) => r.data.data.attendance),
  clockOut: () => apiClient.post("/attendance/clock-out").then((r) => r.data.data.attendance),
  // Manager-only correction; send only the fields that changed.
  update: (id, payload) =>
    apiClient.patch(`/attendance/${id}`, payload).then((r) => r.data.data.attendance),
  // Manager-only: people to choose from in the employee filter.
  employees: () => apiClient.get("/attendance/employees").then((r) => r.data.data.employees),
  // Resolves to { items, pagination } — pagination is { page, pageSize, totalItems, totalPages }.
  list: (params) =>
    apiClient
      .get("/attendance", { params: cleanParams(params) })
      .then((r) => ({ items: r.data.data.attendance, pagination: r.data.meta })),
  // params: { month?: "YYYY-MM", userId?, designationId? } (filters only apply for
  // attendance.update; everyone else gets their own row). Resolves to
  // { month, workingDays, totals: { staffCount, approvedOvertimeMinutes,
  //   pendingOvertimeMinutes, averageAttendancePercent }, staff: [...] }.
  monthlySummary: (params) =>
    apiClient.get("/attendance/summary", { params: cleanParams(params) }).then((r) => r.data.data.summary),
};
