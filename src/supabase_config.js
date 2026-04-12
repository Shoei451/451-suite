import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://abfuanjincelcyrlswsp.supabase.co";
const SUPABASE_KEY = "sb_publishable_uZuTU24T38xW7iAsXJIQ-g_OfuLjyjJ";

// ── テーブル名定数 ───────────────────────────────────────────
export const tables = {
  CALENDAR_APP: "calendar_app"
  //全テーブルの変数定義
};

export const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// 非 module の既存コードからも参照できるようにする
window.SUPABASE_TABLES = tables;
window._db = db;
