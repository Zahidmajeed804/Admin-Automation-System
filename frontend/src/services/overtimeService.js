import apiClient from "./apiClient";
import { cleanParams } from "../utils/cleanParams";

export const overtimeService = {
  // Resolves to { items, pagination } — pagination is { page, pageSize, totalItems, totalPages }.
  // Reviewers get everyone's requests; anyone else gets only their own.
  list: (params) =>
    apiClient
      .get("/overtime", { params: cleanParams(params) })
      .then((r) => ({ items: r.data.data.overtime, pagination: r.data.meta })),
  // Reviewer-only. payload is { decision: "approved" | "rejected", note? }.
  review: (id, payload) =>
    apiClient.patch(`/overtime/${id}/review`, payload).then((r) => r.data.data.overtime),
};
