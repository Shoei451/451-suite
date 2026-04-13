import { db } from "./supabase_config.js";

const { data: { session } } = await db.auth.getSession();
if (!session) {
  const depth = location.pathname.split("/").filter(Boolean).length;
  const prefix = depth > 1 ? "../".repeat(depth - 1) : "./";
  location.replace(prefix + "home.html");
}
export const user = session?.user ?? null;