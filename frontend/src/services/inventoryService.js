import apiClient from "./apiClient";

export const inventoryService = {
  dashboard: (type) => apiClient.get("/inventory/dashboard", { params: { type } }).then((r) => r.data.data),

  listItems: (params) =>
    apiClient.get("/inventory", { params }).then((r) => ({ items: r.data.data, meta: r.data.meta })),

  getItem: (id) => apiClient.get(`/inventory/${id}`).then((r) => r.data.data),

  createItem: (payload) => apiClient.post("/inventory", payload).then((r) => r.data.data),

  updateItem: (id, payload) => apiClient.put(`/inventory/${id}`, payload).then((r) => r.data.data),

  deactivateItem: (id) => apiClient.delete(`/inventory/${id}`).then((r) => r.data),

  recordPurchase: (payload) => apiClient.post("/inventory/purchases", payload).then((r) => r.data.data),

  listPurchases: (params) =>
    apiClient.get("/inventory/purchases", { params }).then((r) => ({ purchases: r.data.data, meta: r.data.meta })),

  consume: (id, payload) => apiClient.post(`/inventory/${id}/consume`, payload).then((r) => r.data.data),
};
