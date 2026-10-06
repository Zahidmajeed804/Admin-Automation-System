// Shared by all three report views (Attendance/Overtime/Leave) — their
// export buttons all do the same blob-download + error-extraction, so this
// stays one copy instead of being repeated per view.

// Saves the file the browser just fetched, the same way a normal link
// download would — mirrors GeneratorMaintenanceInvoice.jsx's saveBlob.
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Pulls a readable message out of an Axios error using the backend's
// { message, details } envelope — mirrors GeneratorForm.jsx's extractErrorMessage.
export function extractErrorMessage(err) {
  const data = err?.response?.data;
  if (!data) return err?.message || "Something went wrong. Please try again.";
  if (Array.isArray(data.details) && data.details.length) {
    return data.details.map((d) => d.message || `${d.field}: invalid`).join(" ");
  }
  if (data.details && typeof data.details === "object") {
    return `${data.message} (${Object.keys(data.details).join(", ")})`;
  }
  return data.message || "Something went wrong. Please try again.";
}
