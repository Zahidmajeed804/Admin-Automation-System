// Filter inputs often arrive as "" (an empty select/date field). The backend
// validators reject empty strings, so drop anything that isn't a real value.
export const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );
