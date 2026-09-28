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
  // Own balance by default; params can add { userId, year } — reviewers only for userId.
  // Resolves to { userId, year, balances: { casual, sick, annual } }, each
  // { allocated, used, pending, remaining }. Unpaid leave isn't included (no limit).
  balance: (params) => apiClient.get("/leave/balance", { params: cleanParams(params) }).then((r) => r.data.data),
};
