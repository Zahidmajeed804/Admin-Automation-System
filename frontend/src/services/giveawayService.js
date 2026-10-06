import apiClient from "./apiClient";

export const giveawayService = {
  dashboard: () => apiClient.get("/giveaways/dashboard").then((r) => r.data.data),

  listItems: (params) =>
    apiClient.get("/giveaways", { params }).then((r) => ({ items: r.data.data, meta: r.data.meta })),

  getItem: (id) => apiClient.get(`/giveaways/${id}`).then((r) => r.data.data),

  createItem: (payload) => apiClient.post("/giveaways", payload).then((r) => r.data.data),

  updateItem: (id, payload) => apiClient.put(`/giveaways/${id}`, payload).then((r) => r.data.data),

  deactivateItem: (id) => apiClient.delete(`/giveaways/${id}`).then((r) => r.data),

  stockIn: (id, payload) => apiClient.post(`/giveaways/${id}/stock-in`, payload).then((r) => r.data.data),

  stockOut: (id, payload) => apiClient.post(`/giveaways/${id}/stock-out`, payload).then((r) => r.data.data),

  issueItem: (payload) => apiClient.post("/giveaways/issues", payload).then((r) => r.data.data),

  listIssues: (params) =>
    apiClient.get("/giveaways/issues", { params }).then((r) => ({ issues: r.data.data, meta: r.data.meta })),
};
