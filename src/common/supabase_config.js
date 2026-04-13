import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://abfuanjincelcyrlswsp.supabase.co";
const SUPABASE_KEY = "sb_publishable_uZuTU24T38xW7iAsXJIQ-g_OfuLjyjJ";

export const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Table name registry ──────────────────────────────────────
// All table names are defined here. Import and use tables.XXX instead of
// writing raw strings in application code.
//
// Usage:
//   import { tables } from "/common/supabase_config.js";
//   db.from(tables.CALENDAR_APP).select("*")
//
export const tables = {
  // ── calendar app ──────────────────────────────────────────
  CALENDAR_APP: "calendar_app",
  CALENDAR_TIMETABLE: "calendar_timetable",

  // ── toshin tracker ────────────────────────────────────────
  TOSHIN_COURSES: "toshin_courses",
  TOSHIN_UNITS: "toshin_units",
  TOSHIN_MONTHLY_GOALS: "toshin_monthly_goals",
  TOSHIN_MASTERS: "toshin_masters",
  TOSHIN_MASTER_STAGES: "toshin_master_stages",
  TOSHIN_MASTER_PROGRESS: "toshin_master_progress",

  // ── schedule tracker ──────────────────────────────────────
  WEEKLY_SCHEDULE: "weekly_schedule",
};