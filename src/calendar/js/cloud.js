import { db as supabaseClient, tables } from "/common/supabase_config.js";
import { state } from "./state.js";

let syncChannel = null;
export let isRemoteLoading = false;

export function setSyncStatus(text, isError = false) {
  const el = document.getElementById("syncStatus");
  const textEl = document.getElementById("syncText");
  if (!el || !textEl) return;
  el.className = "sync-status" + (isError ? " error" : "");
  textEl.textContent = text;
}

export const hasCloud = () => !!(supabaseClient && state.user);

// toCloudPayload に3フィールド追加
export function toCloudPayload(ev) {
  return {
    id: ev.id,
    group_id: ev.group_id ?? null,
    repeat_group_id: ev.repeat_group_id ?? null, // ← 追加
    date: ev.date,
    title: ev.title,
    course: ev.course,
    type: ev.type,
    start: ev.start ?? null, // ← 追加
    end: ev.end ?? null, // ← 追加
    notes: ev.notes,
    user_id: state.user.id,
  };
}

// 変更前（ローカルとのマージ処理を丸ごと削除）
export async function loadRemoteEvents() {
  if (!hasCloud() || isRemoteLoading) return;
  isRemoteLoading = true;
  setSyncStatus("syncing...");
  try {
    const { data, error } = await supabaseClient
      .from(tables.CALENDAR_APP)
      .select("*")
      .eq("user_id", state.user.id)
      .order("date", { ascending: true });
    if (error) throw error;

    // 変更後：クラウドをそのまま使うだけ
    state.events = (data || []).map(({ user_id, ...ev }) => ev);
    setSyncStatus(`synced (${state.events.length} items)`);
  } catch (err) {
    setSyncStatus(`sync error: ${err.message}`, true);
    throw err;
  } finally {
    isRemoteLoading = false;
  }
}

export async function saveEventCloud(event) {
  if (!hasCloud()) return;
  const { error } = await supabaseClient
    .from(tables.CALENDAR_APP)
    .upsert(toCloudPayload(event));
  if (error) throw error;
}

export async function deleteEventCloud(id) {
  if (!hasCloud() || !id) return;
  const { error } = await supabaseClient
    .from(tables.CALENDAR_APP)
    .delete()
    .eq("id", id)
    .eq("user_id", state.user.id);
  if (error) throw error;
}

export async function deleteGroupCloud(groupId) {
  if (!hasCloud() || !groupId) return;
  const { error } = await supabaseClient
    .from(tables.CALENDAR_APP)
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", state.user.id);
  if (error) throw error;
}

export async function updateGroupCloud(groupId, updates) {
  if (!hasCloud() || !groupId) return;
  const { error } = await supabaseClient
    .from(tables.CALENDAR_APP)
    .update({
      title: updates.title,
      course: updates.course,
      type: updates.type,
      notes: updates.notes,
    })
    .eq("group_id", groupId)
    .eq("user_id", state.user.id);
  if (error) throw error;
}

export async function clearAllCloud() {
  if (!hasCloud()) return;
  const { error } = await supabaseClient
    .from(tables.CALENDAR_APP)
    .delete()
    .eq("user_id", state.user.id);
  if (error) throw error;
}

export function subscribeRealtime(onUpdate) {
  if (!hasCloud()) return;
  if (syncChannel) {
    supabaseClient.removeChannel(syncChannel);
    syncChannel = null;
  }
  syncChannel = supabaseClient
    .channel("calendar_sync")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: tables.CALENDAR_APP,
        filter: `user_id=eq.${state.user.id}`,
      },
      onUpdate,
    )
    .subscribe();
}

export function unsubscribeRealtime() {
  if (syncChannel) {
    supabaseClient?.removeChannel(syncChannel);
    syncChannel = null;
  }
}

// 繰り返しイベントグループの削除（グループIDで一括削除）
export async function deleteRepeatGroupCloud(repeatGroupId) {
  if (!hasCloud() || !repeatGroupId) return;
  const { error } = await supabaseClient
    .from(tables.CALENDAR_APP)
    .delete()
    .eq("repeat_group_id", repeatGroupId)
    .eq("user_id", state.user.id);
  if (error) throw error;
}

// ── Timetable sync ────────────────────────────────────────────
export async function loadTimetableCloud(userId) {
  if (!supabaseClient || !userId) return [];
  const { data, error } = await supabaseClient
    .from(tables.CALENDAR_TIMETABLE)
    .select("id, day_of_week, period, subject, icon_key")
    .eq("user_id", userId);
  if (error) throw error;
  return data || [];
}
