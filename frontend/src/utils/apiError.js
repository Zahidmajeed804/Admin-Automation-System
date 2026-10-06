// Best human-readable message from a failed API call: validation details first,
// then the server's message, then the caller's fallback.
export const apiErrorMessage = (err, fallback = "Something went wrong. Please try again.") => {
  const data = err?.response?.data;
  const details = data?.details?.map((d) => d.message).join(". ");
  return details || data?.message || fallback;
};
