// Turns an axios error into one readable sentence.
// DRF returns errors as {detail}, {field: [messages]} or {non_field_errors: [messages]}.
export function formatApiError(err, fallback = "Something went wrong. Please try again.") {
  if (err && !err.response) return "Can't reach the server. Check your connection and try again.";
  const data = err?.response?.data;
  if (!data || typeof data === "string") return fallback;
  if (data.detail) return data.detail;
  const parts = Object.values(data).flat().filter((value) => typeof value === "string");
  return parts.length ? parts.join(" ") : fallback;
}