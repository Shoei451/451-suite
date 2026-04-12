import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://abfuanjincelcyrlswsp.supabase.co";
const SUPABASE_KEY = "sb_publishable_uZuTU24T38xW7iAsXJIQ-g_OfuLjyjJ";

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
