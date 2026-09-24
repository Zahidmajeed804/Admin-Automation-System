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
};
