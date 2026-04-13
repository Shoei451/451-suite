import { $, state, formatDate, uid } from "./state.js";
import { render, openModal } from "./render.js";
import {
  hasCloud,
  setSyncStatus,
  clearAllCloud,
  loadRemoteEvents,
  subscribeRealtime,
} from "./cloud.js";
import { user, wireLogoutButton } from "/common/auth-guard.js";
import { initTabs } from "./tabs.js";
import { initTimetable } from "./timetable.js";
import { db as supabaseClient, tables } from "/common/supabase_config.js";

const userInfoBox = document.getElementById("userInfoBox");
const userEmailEl = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");

state.user = user;
if (user) {
  document.getElementById("mainApp")?.classList.add("visible");
  if (userInfoBox) userInfoBox.style.display = "";
  if (userEmailEl) userEmailEl.textContent = user.email || "";
  if (logoutBtn) logoutBtn.style.display = "";
  wireLogoutButton("logoutBtn");
}

$("#filterCourse").onchange = (e) => {
  state.filterCourse = e.target.value;
  render();
};
$("#filterType").onchange = (e) => {
  state.filterType = e.target.value;
  render();
};

// ── JSON エクスポート ──────────────────────────────────────────
$("#exportBtn").onclick = () => {
  const blob = new Blob([JSON.stringify(state.events, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `student-calendar-${state.year}-${state.month + 1}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};

// ── JSON インポート ────────────────────────────────────────────
$("#importFile").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error("JSONが配列形式ではありません");
    const map = new Map(state.events.map((ev) => [ev.id, ev]));
    data.forEach((ev) => {
      if (!ev.id) ev.id = uid();
      map.set(ev.id, ev);
    });
    state.events = Array.from(map.values());
    //storage.set(state.events);
    if (hasCloud()) {
      setSyncStatus("同期中...");
      const payload = state.events.map((ev) => ({
        ...ev,
        user_id: state.user.id,
      }));
      const { error } = await supabaseClient
        .from(tables.CALENDAR_APP)
        .upsert(payload);
      if (error) throw error;
      setSyncStatus(`同期済み（${state.events.length}件）`);
    }
    render();
    alert(`インポート完了（${data.length}件）`);
  } catch (err) {
    alert("インポートに失敗しました: " + err.message);
  }
  e.target.value = "";
};

// ── 全消去 ────────────────────────────────────────────────────
$("#clearBtn").onclick = async () => {
  if (!confirm("すべての予定を削除しますか？この操作は取り消せません。"))
    return;
  state.events = [];
  //storage.set(state.events);
  if (hasCloud()) {
    try {
      setSyncStatus("同期中...");
      await clearAllCloud();
      setSyncStatus("同期済み（0件）");
    } catch (err) {
      setSyncStatus(`同期エラー: ${err.message}`, true);
    }
  }
  render();
};

// PDF エクスポート
document.getElementById("exportPdfBtn")?.addEventListener("click", () => {
  const originalTitle = document.title;
  const y = state.year;
  const m = String(state.month + 1).padStart(2, "0");
  const monthLabel = `${y}年${Number(m)}月`;

  // メタデータ構築
  const inMonth = state.events.filter((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === y && d.getMonth() === state.month;
  });
  const now = new Date();
  const printDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} 印刷`;

  const metaLeft = document.getElementById("printMetaLeft");
  const metaRight = document.getElementById("printMetaRight");
  if (metaLeft) metaLeft.textContent = `${monthLabel} ／ ${inMonth.length}件`;
  if (metaRight) metaRight.textContent = printDate;

  // 表示
  const metaBar = document.getElementById("printMeta");
  if (metaBar) metaBar.style.display = "";

  document.title = `calendar-${y}-${m}`;
  document
    .getElementById("panel-calendar")
    ?.setAttribute("data-print-title", monthLabel);
  location.hash = "calendar";

  requestAnimationFrame(() => {
    window.print();
    const restore = () => {
      document.title = originalTitle;
      if (metaBar) metaBar.style.display = "none";
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    setTimeout(restore, 30000);
  });
});

// ── 起動 ──────────────────────────────────────────────────────
initTabs();
initTimetable();
if (user) {
  try {
    await loadRemoteEvents();
    subscribeRealtime(async () => {
      try {
        await loadRemoteEvents();
        render();
      } catch {
        // loadRemoteEvents updates sync status on failure.
      }
    });
  } catch {
    // loadRemoteEvents updates sync status on failure.
  }
}
render();
