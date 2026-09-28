/**
 * Turns a caught axios error into a message that actually says what went wrong, instead of every
 * failure (permission, not-found, server bug, dead connection) rendering the same generic
 * "couldn't load" text. Pass the raw error from a catch block — not a boolean.
 */
export function describeError(error) {
  const status = error?.response?.status;
  if (status === 401 || status === 403) {
    return "You don't have permission to view this.";
  }
  if (status === 404) {
    return "This isn't available right now. It may have moved or been removed.";
  }
  if (status >= 500) {
    return "The server ran into a problem loading this. Please try again.";
  }
  if (!error?.response) {
    return "Can't reach the server. Check your connection and try again.";
  }
  return "We couldn't load this data. Please try again.";
}
