import apiClient from "./apiClient";
import { cleanParams } from "../utils/cleanParams";

// Staff management (admin only) — create logins, edit, activate/deactivate.
export const userService = {
  // Resolves to { items, pagination } — pagination is { page, pageSize, totalItems, totalPages }.
  list: (params) =>
    apiClient
      .get("/users", { params: cleanParams(params) })
      .then((r) => ({ items: r.data.data.users, pagination: r.data.meta })),
  create: (payload) => apiClient.post("/users", payload).then((r) => r.data.data.user),
  update: (id, payload) => apiClient.patch(`/users/${id}`, payload).then((r) => r.data.data.user),
  setActive: (id, isActive) =>
    apiClient.patch(`/users/${id}/status`, { isActive }).then((r) => r.data.data.user),
};
