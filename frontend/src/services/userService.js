import apiClient from "./apiClient";
import { cleanParams } from "../utils/cleanParams";

// Staff management (admin only) — create logins, edit, activate/deactivate.
export const userService = {
  // Lightweight employee picker for the Team Overtime/Leave filters. Any
  // reviewer (overtime.approve or leave.approve) can call this even without
  // users.manage — see backend/src/routes/user.routes.js.
  options: () => apiClient.get("/users/options").then((r) => r.data.data.users),
  // Resolves to { items, pagination } — pagination is { page, pageSize, totalItems, totalPages }.
  list: (params) =>
    apiClient
      .get("/users", { params: cleanParams(params) })
      .then((r) => ({ items: r.data.data.users, pagination: r.data.meta })),
  create: (payload) => apiClient.post("/users", payload).then((r) => r.data.data.user),
  update: (id, payload) => apiClient.patch(`/users/${id}`, payload).then((r) => r.data.data.user),
  setActive: (id, isActive) =>
    apiClient.patch(`/users/${id}/status`, { isActive }).then((r) => r.data.data.user),
  // payload is { casual, sick, annual, overwrite? }. Applies to every active account;
  // overwrite:false (the default) only fills accounts with no allocation set yet.
  // Resolves to { matched, modified }.
  assignLeaveAllocationToAll: (payload) =>
    apiClient.put("/users/leave-allocation/all", payload).then((r) => r.data.data),
};
