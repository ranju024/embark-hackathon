export function localIso(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const todayIso = () => localIso(new Date());

// "08:00:00" -> "8:00 AM"
export function formatTime(value) {
  if (!value) return "";
  const [hours, minutes] = value.split(":");
  const d = new Date();
  d.setHours(Number(hours), Number(minutes || 0), 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// "2026-11-17" -> "Tuesday, Nov 17"
export function formatDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long", month: "short", day: "numeric",
  });
}