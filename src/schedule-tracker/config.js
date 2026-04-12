// ============================================================
// CONFIG
// ============================================================
const { createClient } = supabase;
const db = createClient(
  "https://abfuanjincelcyrlswsp.supabase.co",
  "sb_publishable_uZuTU24T38xW7iAsXJIQ-g_OfuLjyjJ",
);

const TABLE = "weekly_schedule";
const DAYS = ["日", "月", "火", "水", "木", "金", "土"];
const WEEKDAY_NAMES = [
  "日曜日",
  "月曜日",
  "火曜日",
  "水曜日",
  "木曜日",
  "金曜日",
  "土曜日",
];
const COLORS = [
  "#6d28d9",
  "#2563eb",
  "#059669",
  "#d97706",
  "#dc2626",
  "#0891b2",
  "#be185d",
  "#4b5563",
];
