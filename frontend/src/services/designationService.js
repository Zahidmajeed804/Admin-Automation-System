import apiClient from "./apiClient";
import { cleanParams } from "../utils/cleanParams";

// Designations (job titles) and the shift length each one sets. Listing needs
// users.manage or attendance.update; creating and editing need users.manage.
export const designationService = {
  // params: { status?: "active" | "inactive" }. Resolves to an array, sorted by name.
  list: (params) =>
    apiClient
      .get("/designations", { params: cleanParams(params) })
      .then((r) => r.data.data.designations),
  // payload: { name, shiftHours }
  create: (payload) => apiClient.post("/designations", payload).then((r) => r.data.data.designation),
  // payload: any of { name, shiftHours, isActive }
  update: (id, payload) => apiClient.patch(`/designations/${id}`, payload).then((r) => r.data.data.designation),
};
