import apiClient from "./apiClient";

// Mirrors generatorService's `one` — every report endpoint resolves the
// report object itself (totals + per-employee rows), never { items }.
const one = (r) => r.data.data;

const REPORT_PATHS = {
  "attendance-summary": "/reports/attendance-summary",
  "overtime-summary": "/reports/overtime-summary",
  "leave-usage": "/reports/leave-usage",
};

export const reportsService = {
  getAttendanceSummaryReport: (params) => apiClient.get(REPORT_PATHS["attendance-summary"], { params }).then(one),
  getOvertimeSummaryReport: (params) => apiClient.get(REPORT_PATHS["overtime-summary"], { params }).then(one),
  getLeaveUsageReport: (params) => apiClient.get(REPORT_PATHS["leave-usage"], { params }).then(one),

  // `report` picks the endpoint (one of the keys above); `format` is "csv"
  // or "pdf"; the rest of `params` are the same filters the matching
  // getXReport call used. Resolves { blob, filename } — mirrors
  // generatorService.downloadInvoice exactly, for a caller-side saveBlob().
  exportReport: async (report, { format = "csv", ...params } = {}) => {
    const path = REPORT_PATHS[report];
    const res = await apiClient.get(`${path}/export`, { params: { ...params, format }, responseType: "blob" });
    const match = /filename="?([^"; ]+)"?/i.exec(res.headers["content-disposition"] || "");
    return { blob: res.data, filename: match ? match[1] : `${report}.${format}` };
  },
};
