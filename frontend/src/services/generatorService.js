import apiClient from "./apiClient";

// List endpoints return { data, meta } (pagination) from the backend, so
// their methods resolve { items, meta } — unlike authService's plain
// `.then((r) => r.data.data)`, which never needs pagination info.
const list = (r) => ({ items: r.data.data, meta: r.data.meta });
const one = (r) => r.data.data;

export const generatorService = {
  // Generators
  listGenerators: (params) => apiClient.get("/generator", { params }).then(list),
  getGenerator: (id) => apiClient.get(`/generator/${id}`).then(one),
  createGenerator: (payload) => apiClient.post("/generator", payload).then(one),
  updateGenerator: (id, payload) => apiClient.patch(`/generator/${id}`, payload).then(one),
  deleteGenerator: (id) => apiClient.delete(`/generator/${id}`).then(one),

  // Usage/fuel logs
  listLogs: (params) => apiClient.get("/generator/logs", { params }).then(list),
  createLog: (payload) => apiClient.post("/generator/logs", payload).then(one),
  deleteLog: (logId) => apiClient.delete(`/generator/logs/${logId}`).then(one),

  // Maintenance
  listMaintenance: (params) => apiClient.get("/generator/maintenance", { params }).then(list),
  getMaintenanceAlerts: (params) => apiClient.get("/generator/maintenance/alerts", { params }).then(one),
  createMaintenance: (payload) => apiClient.post("/generator/maintenance", payload).then(one),
  // Covers edit, cancel (status: "cancelled") and complete (status: "completed") —
  // the backend distinguishes them by the request body, not the route.
  updateMaintenance: (id, payload) => apiClient.patch(`/generator/maintenance/${id}`, payload).then(one),
  deleteMaintenance: (id) => apiClient.delete(`/generator/maintenance/${id}`).then(one),
};
