import apiClient from "./apiClient";
import { cleanParams } from "../utils/cleanParams";

export const leaveService = {
  // Resolves to { items, pagination } — pagination is { page, pageSize, totalItems, totalPages }.
  // Reviewers get everyone's requests; anyone else gets only their own.
  list: (params) =>
    apiClient
      .get("/leave", { params: cleanParams(params) })
      .then((r) => ({ items: r.data.data.leave, pagination: r.data.meta })),
  // payload is { leaveType, startDate, endDate, reason? }; dates are "YYYY-MM-DD".
  create: (payload) => apiClient.post("/leave", payload).then((r) => r.data.data.leave),
  // Reviewer-only. payload is { decision: "approved" | "rejected", note? }.
  review: (id, payload) =>
    apiClient.patch(`/leave/${id}/review`, payload).then((r) => r.data.data.leave),
};
