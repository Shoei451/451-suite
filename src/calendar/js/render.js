import {
  state,
  $,
  escapeHtml,
  formatDate,
  CATEGORY_CSS_KEY,
  CATEGORY_ICON,
  NO_COURSE_TYPES,
  uid,
} from "./state.js";

// icons.jsからgetIconをimport（追加）:
import { getIcon } from "./icons.js";

import {
  hasCloud,
  setSyncStatus,
  saveEventCloud,
  deleteEventCloud,
  deleteGroupCloud,
  deleteRepeatGroupCloud, // ← 追加
  updateGroupCloud,
} from "./cloud.js";
const monthSelect = document.getElementById("monthSelect");
const yearSelect = document.getElementById("yearSelect");
const eventModal = document.getElementById("eventModal");

// ── クラウド同期タスクを後で実行するヘルパー ──
const syncLater = (tasks) => {
  if (!hasCloud()) return;
  setSyncStatus("同期中...");
  (async () => {
    try {
      for (const task of tasks) await task();
      setSyncStatus(`同期済み（${state.events.length}件）`);
    } catch (err) {
      setSyncStatus(`同期エラー: ${err.message}`, true);
    }
  })();
};

// ── パフォーマンス：イベントインデックスキャッシュ ─────────────
let _cachedIndex = null;
let _cachedEventsRef = null;
let _cachedFilter = "";

function getEventIndex() {
  const filterKey = state.filterCourse + "|" + state.filterType;
  if (
    _cachedIndex &&
    _cachedEventsRef === state.events &&
    _cachedFilter === filterKey
  ) {
    return _cachedIndex;
  }
  const byDate = new Map();
  for (const e of state.events) {
    if (state.filterCourse && e.course !== state.filterCourse) continue;
    if (state.filterType && e.type !== state.filterType) continue;
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date).push(e);
  }
  for (const [, list] of byDate) {
    list.sort((a, b) => (a.start || "").localeCompare(b.start || ""));
  }
  _cachedIndex = byDate;
  _cachedEventsRef = state.events;
  _cachedFilter = filterKey;
  return byDate;
}

function invalidateCache() {
  _cachedIndex = null;
  _cachedEventsRef = null;
}

// ── ヘルパー ──────────────────────────────────────────────────
function getFilteredEvents() {
  return state.events.filter(
    (e) =>
      (!state.filterCourse || e.course === state.filterCourse) &&
      (!state.filterType || e.type === state.filterType),
  );
}

function getSortedCourses() {
  return [...new Set(state.events.map((e) => e.course).filter(Boolean))].sort();
}

function getMonthMatrix(y, m) {
  const days = [];
  const firstDay = new Date(y, m, 1);
  let dow = firstDay.getDay();
  dow = dow === 0 ? 6 : dow - 1;
  for (let i = 0; i < dow; i++) days.push(null);
  const lastDate = new Date(y, m + 1, 0).getDate();
  for (let d = 1; d <= lastDate; d++) days.push(new Date(y, m, d));
  return days;
}

// ── 繰り返し日付生成 ──────────────────────────────────────────
// repeatDays: [0=月, 1=火, ..., 6=日]
export function generateRepeatDates(startDate, repeatDays, endDate) {
  const dates = [];
  const end = new Date(endDate);
  const cur = new Date(startDate);
  // JS: 0=日,1=月,...,6=土 → UI: 0=月,1=火,...,6=日
  const jsToUi = (d) => (d === 0 ? 6 : d - 1);
  let safety = 0;
  while (cur <= end && safety < 1000) {
    if (repeatDays.includes(jsToUi(cur.getDay()))) {
      dates.push(formatDate(new Date(cur)));
    }
    cur.setDate(cur.getDate() + 1);
    safety++;
  }
  return dates;
}

// ── レンダリング ──────────────────────────────────────────────
export function render() {
  if (monthSelect) monthSelect.value = state.month;
  if (yearSelect) yearSelect.value = state.year;
  invalidateCache();
  renderCalendar();
  renderDashboard();
  fillCourseDatalist();
}

function renderCalendar() {
  const cal = document.getElementById("calendar");
  if (!cal) return;

  // 曜日ヘッダーは初回のみ生成、以降は .cell だけ差し替え
  if (!cal.querySelector(".dow")) {
    const frag = document.createDocumentFragment();
    ["月", "火", "水", "木", "金", "土", "日"].forEach((d) => {
      const h = document.createElement("div");
      h.className = "dow";
      h.textContent = d;
      frag.appendChild(h);
    });
    cal.appendChild(frag);
  } else {
    cal.querySelectorAll(".cell").forEach((c) => c.remove());
  }

  const cells = getMonthMatrix(state.year, state.month);
  const todayStr = formatDate(new Date());
  const byDate = getEventIndex();
  const frag = document.createDocumentFragment();

  cells.forEach((d) => {
    const cell = document.createElement("div");
    if (d === null) {
      cell.className = "cell empty";
      frag.appendChild(cell);
      return;
    }
    const dStr = formatDate(d);
    const inMonth = d.getMonth() === state.month;
    const evList = byDate.get(dStr) || [];

    cell.className = "cell heat-" + Math.min(4, evList.length);
    if (!inMonth) cell.style.opacity = "0.35";
    if (dStr === todayStr) cell.classList.add("today");

    const dateEl = document.createElement("div");
    dateEl.className = "date";
    dateEl.textContent = d.getDate();
    cell.appendChild(dateEl);

    if (inMonth) {
      evList.slice(0, 4).forEach((e) => {
        const row = document.createElement("div");
        const cssKey = CATEGORY_CSS_KEY[e.type] || "other";
        const iconName = CATEGORY_ICON[e.type] || "bi-three-dots";
        const timeStr = e.start ? e.start : "";
        row.className = "ev-row";
        row.style.setProperty("--ev-bg", `var(--cat-${cssKey}-bg)`);
        row.style.setProperty("--ev-fg", `var(--cat-${cssKey}-fg)`);
        row.title = `${e.title || "無題"}${e.course ? "（" + e.course + "）" : ""}${timeStr ? " " + timeStr : ""}`;
        row.innerHTML = `
      <span class="ev-icon">${getIcon(iconName)}</span>
      <span class="ev-title">${escapeHtml(e.title || "無題")}</span>
    `;
        row.onclick = (ev) => {
          ev.stopPropagation();
          openModal(e);
        };
        cell.appendChild(row);
      });

      // 4件超過の場合（既存コードにはないが追加推奨）:
      if (evList.length > 4) {
        const more = document.createElement("div");
        more.className = "ev-more";
        more.textContent = `+${evList.length - 4}`;
        cell.appendChild(more);
      }
    }

    cell.onclick = (ev) => {
      if (ev.target === cell || ev.target === dateEl) openModal({ date: dStr });
    };
    frag.appendChild(cell);
  });

  cal.appendChild(frag);
}

function renderDashboard() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(state.year, state.month, 1);
  const monthEnd = new Date(state.year, state.month + 1, 0);
  const filtered = getFilteredEvents();

  const inMonth = filtered.filter((e) => {
    const d = new Date(e.date);
    return d >= monthStart && d <= monthEnd;
  });
  const soon = filtered.filter((e) => {
    const d = new Date(e.date);
    const diff = (d - now) / 864e5;
    return diff >= 0 && diff <= 7;
  });
  const upcoming = filtered
    .filter((e) => new Date(e.date) >= todayStart)
    .sort((a, b) => {
      const dc = new Date(a.date) - new Date(b.date);
      return dc !== 0 ? dc : (a.start || "").localeCompare(b.start || "");
    })
    .slice(0, 20);

  document.getElementById("kpiTotal").textContent = inMonth.length;
  document.getElementById("kpiAll").textContent = filtered.length;
  document.getElementById("kpiSoon").textContent = soon.length;

  const fc = document.getElementById("filterCourse");
  if (fc) {
    const courses = getSortedCourses();
    fc.innerHTML =
      '<option value="">すべての科目</option>' +
      courses
        .map(
          (c) =>
            `<option${c === state.filterCourse ? " selected" : ""}>${escapeHtml(c)}</option>`,
        )
        .join("");
  }

  const box = document.getElementById("upcoming");
  if (!box) return;

  if (!upcoming.length) {
    box.innerHTML = '<div class="hint">直近の予定はありません。</div>';
    return;
  }

  const frag = document.createDocumentFragment();
  upcoming.forEach((e) => {
    const it = document.createElement("div");
    it.className = "item";
    const timeStr = e.start ? ` ${e.start}${e.end ? "〜" + e.end : ""}` : "";
    const left = document.createElement("div");
    left.innerHTML = `<strong>${e.repeat_group_id ? `<span class="repeat-badge">${getIcon("bi-arrow-repeat")}</span> ` : ""}${escapeHtml(e.title || "無題")}</strong>
      <div class="meta">
        ${getIcon("bi-calendar3")}
        ${escapeHtml(e.date)}${escapeHtml(timeStr)} · ${escapeHtml(e.course || "科目未設定")} · ${escapeHtml(e.type || "その他")}
      </div>
      ${e.notes ? `<div class="hint" style="margin-top:4px;">${escapeHtml(e.notes)}</div>` : ""}`;
    const right = document.createElement("div");
    right.style.cssText =
      "display:flex;flex-direction:column;gap:6px;align-items:flex-end";
    const editBtn = document.createElement("button");
    editBtn.textContent = "編集";
    editBtn.onclick = () => openModal(e);
    right.appendChild(editBtn);
    it.appendChild(left);
    it.appendChild(right);
    frag.appendChild(it);
  });

  box.innerHTML = "";
  box.appendChild(frag);
}

function fillCourseDatalist() {
  const list = document.getElementById("courseList");
  if (!list) return;
  list.innerHTML = getSortedCourses()
    .map((c) => `<option value="${escapeHtml(c)}">`)
    .join("");
}

// ── 繰り返しUIの状態 ─────────────────────────────────────────
let selectedRepeatDays = [];

function initRepeatDayButtons() {
  const container = document.getElementById("repeatDaysContainer");
  if (!container || container.dataset.initialized) return;
  container.dataset.initialized = "true";
  ["月", "火", "水", "木", "金", "土", "日"].forEach((label, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.className = `repeat-day-btn${i === 5 ? " sat" : i === 6 ? " sun" : ""}`;
    btn.dataset.day = i;
    btn.addEventListener("click", () => {
      const day = parseInt(btn.dataset.day);
      if (selectedRepeatDays.includes(day)) {
        selectedRepeatDays = selectedRepeatDays.filter((d) => d !== day);
        btn.classList.remove("active");
      } else {
        selectedRepeatDays.push(day);
        btn.classList.add("active");
      }
    });
    container.appendChild(btn);
  });
}

function syncRepeatDayButtons() {
  document.querySelectorAll(".repeat-day-btn").forEach((btn) => {
    btn.classList.toggle(
      "active",
      selectedRepeatDays.includes(parseInt(btn.dataset.day)),
    );
  });
}

function toggleRepeatUI() {
  const isRepeat = document.getElementById("repeatCheck").checked;
  document.getElementById("repeatOptions").style.display = isRepeat
    ? ""
    : "none";
  document.getElementById("repeatEndDateRow").style.display = isRepeat
    ? ""
    : "none";
  // 繰り返しONのとき複数日登録をOFF
  if (isRepeat) {
    document.getElementById("multiDate").checked = false;
    toggleMultiDate();
  }
}

// ── モーダル ──────────────────────────────────────────────────
function updateCourseVisibility() {
  const type = $("#type").value;
  const courseLabel = document.getElementById("courseLabel");
  const courseInput = $("#course");
  const hide = NO_COURSE_TYPES.includes(type);
  courseInput.disabled = hide;
  courseLabel.style.opacity = hide ? "0.45" : "1";
}

function toggleMultiDate() {
  const isMulti = $("#multiDate").checked;
  document.getElementById("endDateRow").style.display = isMulti ? "" : "none";
  document.getElementById("multiDateHint").style.display = isMulti
    ? "block"
    : "none";
  document.getElementById("endDate").required = isMulti;
  if (isMulti) {
    document.getElementById("repeatCheck").checked = false;
    toggleRepeatUI();
  }
}

export function openModal(e = {}) {
  initRepeatDayButtons();

  const isRepeat = !!e.repeat_group_id;
  const isGrouped =
    !isRepeat &&
    e.group_id &&
    state.events.filter((ev) => ev.group_id === e.group_id).length > 1;

  document.getElementById("modalTitle").textContent = e.id
    ? "予定を編集"
    : "予定を追加";
  document.getElementById("eventId").value = e.id || "";
  document.getElementById("groupId").value = e.group_id || "";
  document.getElementById("repeatGroupId").value = e.repeat_group_id || "";
  $("#title").value = e.title || "";
  $("#course").value = e.course || "";
  $("#date").value = e.date || formatDate(new Date(state.year, state.month, 1));
  $("#start").value = e.start || "";
  $("#end").value = e.end || "";
  document.getElementById("endDate").value = "";
  document.getElementById("repeatEndDate").value = "";
  document.getElementById("multiDate").checked = false;
  document.getElementById("repeatCheck").checked = false;
  selectedRepeatDays = [];
  syncRepeatDayButtons();
  toggleRepeatUI();
  toggleMultiDate();
  $("#type").value = e.type || "課題提出日";
  $("#notes").value = e.notes || "";

  const warn = document.getElementById("groupWarning");
  if (isRepeat) {
    const grp = state.events.filter(
      (ev) => ev.repeat_group_id === e.repeat_group_id,
    );
    const dates = grp.map((ev) => ev.date).sort();
    warn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:5px;vertical-align:middle">${getIcon("bi-arrow-repeat")}</span> 繰り返しグループ（全${grp.length}件: ${dates[0]}〜${dates[dates.length - 1]}）`;
    warn.style.display = "block";
  } else if (isGrouped) {
    const grp = state.events.filter((ev) => ev.group_id === e.group_id);
    const dates = grp.map((ev) => ev.date).sort();
    warn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:5px;vertical-align:middle">${getIcon("bi-exclamation-triangle")}</span> グループ予定（${dates[0]}〜${dates[dates.length - 1]}、${grp.length}件）。編集すると全日付に反映されます。`;
    warn.style.display = "block";
  } else {
    warn.style.display = "none";
  }

  updateCourseVisibility();
  document.getElementById("deleteBtn").style.display = e.id ? "" : "none";
  goToStep(1);
  eventModal.showModal();
  $("#title").focus();
}

export const pendingDeletes = new Set();
// ── ステップナビゲーション ────────────────────────────────────
let _currentStep = 1;
const TOTAL_STEPS = 3;

function goToStep(n) {
  _currentStep = n;
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const el = document.getElementById(`step${i}`);
    if (el) el.style.display = i === n ? "" : "none";
  }
  document.querySelectorAll(".step-dot").forEach((dot, idx) => {
    const s = idx + 1;
    dot.classList.toggle("active", s === n);
    dot.classList.toggle("done", s < n);
  });
  const backBtn = document.getElementById("modalBackBtn");
  const nextBtn = document.getElementById("modalNextBtn");
  const saveBtn = document.getElementById("saveBtn");
  if (backBtn) backBtn.style.display = n > 1 ? "" : "none";
  if (nextBtn) nextBtn.style.display = n < TOTAL_STEPS ? "" : "none";
  if (saveBtn) saveBtn.style.display = n === TOTAL_STEPS ? "" : "none";
  if (n === 3) updateCourseVisibility();
  // アニメーション再トリガー
  const stepEl = document.getElementById(`step${n}`);
  if (stepEl) {
    stepEl.style.animation = "none";
    void stepEl.offsetWidth;
    stepEl.style.animation = "";
  }
}

document.getElementById("modalCloseBtn")?.addEventListener("click", () => {
  document.getElementById("eventModal").close();
});
document.getElementById("modalNextBtn")?.addEventListener("click", () => {
  if (_currentStep === 1 && !document.getElementById("title").value.trim()) {
    document.getElementById("title").focus();
    return;
  }
  if (_currentStep < TOTAL_STEPS) goToStep(_currentStep + 1);
});
document.getElementById("modalBackBtn")?.addEventListener("click", () => {
  if (_currentStep > 1) goToStep(_currentStep - 1);
});

// ── クラウド同期ステータス表示 ─────────────────────────────────
$("#type").addEventListener("change", updateCourseVisibility);
$("#multiDate").addEventListener("change", toggleMultiDate);
document
  .getElementById("repeatCheck")
  .addEventListener("change", toggleRepeatUI);

// ── フォーム送信 ──────────────────────────────────────────────
// ── フォーム送信 ──────────────────────────────────────────────
document.getElementById("eventForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const id = document.getElementById("eventId").value || uid();
  const groupId = document.getElementById("groupId").value;
  const repeatGrpId = document.getElementById("repeatGroupId").value;
  const isMulti = document.getElementById("multiDate").checked;
  const isRepeat = document.getElementById("repeatCheck").checked;
  const startDate = $("#date").value;
  const endDate = document.getElementById("endDate").value;
  const repeatEndDate = document.getElementById("repeatEndDate").value;

  const evObj = {
    title: $("#title").value.trim() || "無題",
    course: $("#course").value.trim(),
    type: $("#type").value,
    start: $("#start").value,
    end: $("#end").value,
    notes: $("#notes").value.trim(),
  };

  // multiDate のバリデーション（Bug A対策）
  if (isMulti && endDate && endDate < startDate) {
    alert("終了日は開始日以降にしてください。");
    return;
  }

  try {
    // ── 繰り返し新規登録 ──
    if (isRepeat && !repeatGrpId) {
      if (selectedRepeatDays.length === 0) {
        alert("繰り返す曜日を選択してください。");
        return;
      }
      if (!repeatEndDate) {
        alert("繰り返し終了日を設定してください。");
        return;
      }
      if (repeatEndDate < startDate) {
        alert("終了日は開始日以降にしてください。");
        return;
      }
      const dates = generateRepeatDates(
        startDate,
        selectedRepeatDays,
        repeatEndDate,
      );
      if (dates.length === 0) {
        alert("指定した曜日・期間に該当する日付がありません。");
        return;
      }
      if (
        dates.length > 200 &&
        !confirm(`${dates.length}件の予定を登録します。よろしいですか？`)
      )
        return;
      const newRgid = uid();
      // ① 全件をまず state に追加（Bug C対策）
      const newEvents = dates.map((date) => ({
        ...evObj,
        id: uid(),
        repeat_group_id: newRgid,
        date,
      }));
      state.events.push(...newEvents);
      // ② UI先に更新
      eventModal.close();
      render();
      // ③ クラウドは後で
      syncLater(newEvents.map((e) => () => saveEventCloud(e)));

      // ── 複数日登録 ──
    } else if (isMulti && endDate) {
      const newGroupId = uid();
      const newEvents = [];
      const cur = new Date(startDate);
      const end = new Date(endDate);
      while (cur <= end) {
        newEvents.push({
          ...evObj,
          id: uid(),
          group_id: newGroupId,
          date: formatDate(new Date(cur)),
        });
        cur.setDate(cur.getDate() + 1);
      }
      state.events.push(...newEvents);
      eventModal.close();
      render();
      syncLater(newEvents.map((e) => () => saveEventCloud(e)));

      // ── 繰り返しグループ編集 ──
    } else if (repeatGrpId) {
      const scope = await askRepeatScope();
      if (scope === null) return;
      applyRepeatEdit(repeatGrpId, id, startDate, evObj, scope);
      eventModal.close();
      render();
      const targets =
        scope === "all"
          ? state.events.filter((e) => e.repeat_group_id === repeatGrpId)
          : scope === "this_and_after"
            ? state.events.filter(
                (e) => e.repeat_group_id === repeatGrpId && e.date >= startDate,
              )
            : [state.events.find((e) => e.id === id)].filter(Boolean);
      syncLater(targets.map((e) => () => saveEventCloud(e)));

      // ── 通常グループ編集 ──
    } else if (
      groupId &&
      state.events.filter((e) => e.group_id === groupId).length > 1
    ) {
      state.events = state.events.map((e) =>
        e.group_id === groupId ? { ...e, ...evObj } : e,
      );
      eventModal.close();
      render();
      syncLater([() => updateGroupCloud(groupId, evObj)]);

      // ── 単体 ──
    } else {
      const newEv = {
        ...evObj,
        id,
        group_id: groupId || null,
        date: startDate,
      };
      const idx = state.events.findIndex((e) => e.id === id);
      if (idx >= 0) state.events[idx] = newEv;
      else state.events.push(newEv);
      eventModal.close();
      render();
      syncLater([() => saveEventCloud(newEv)]);
    }
  } catch (err) {
    alert("保存に失敗しました: " + err.message);
  }
});

// ── 繰り返し編集スコープ選択ダイアログ ───────────────────────
function askRepeatScope() {
  return new Promise((resolve) => {
    const dialog = document.getElementById("repeatScopeDialog");
    dialog.returnValue = "";
    dialog.showModal();
    const onClose = () => {
      dialog.removeEventListener("close", onClose);
      resolve(dialog.returnValue || null);
    };
    dialog.addEventListener("close", onClose);
  });
}

function applyRepeatEdit(repeatGrpId, thisId, thisDate, evObj, scope) {
  if (scope === "this") {
    const idx = state.events.findIndex((e) => e.id === thisId);
    if (idx >= 0)
      state.events[idx] = {
        ...state.events[idx],
        ...evObj,
        repeat_group_id: null,
      };
  } else if (scope === "this_and_after") {
    state.events = state.events.map((e) =>
      e.repeat_group_id === repeatGrpId && e.date >= thisDate
        ? { ...e, ...evObj }
        : e,
    );
  } else {
    state.events = state.events.map((e) =>
      e.repeat_group_id === repeatGrpId ? { ...e, ...evObj } : e,
    );
  }
}

// ── 削除 ──────────────────────────────────────────────────────
document.getElementById("deleteBtn").addEventListener("click", async () => {
  const id = document.getElementById("eventId").value;
  const groupId = document.getElementById("groupId").value;
  const repeatGrpId = document.getElementById("repeatGroupId").value;
  if (!id) return;

  const thisDate = state.events.find((e) => e.id === id)?.date;

  try {
    let cloudTasks = [];

    if (repeatGrpId) {
      const scope = await askRepeatScope();
      if (scope === null) return;
      if (scope === "this") {
        state.events = state.events.filter((e) => e.id !== id);
        cloudTasks = [() => deleteEventCloud(id)];
      } else if (scope === "this_and_after") {
        const toDelete = state.events.filter(
          (e) => e.repeat_group_id === repeatGrpId && e.date >= thisDate,
        );
        state.events = state.events.filter(
          (e) => !(e.repeat_group_id === repeatGrpId && e.date >= thisDate),
        );
        cloudTasks = toDelete.map((e) => () => deleteEventCloud(e.id));
      } else {
        state.events = state.events.filter(
          (e) => e.repeat_group_id !== repeatGrpId,
        );
        cloudTasks = [() => deleteRepeatGroupCloud(repeatGrpId)]; // ✅ 修正済み関数
      }
    } else if (
      groupId &&
      state.events.filter((e) => e.group_id === groupId).length > 1
    ) {
      const grpLen = state.events.filter((e) => e.group_id === groupId).length;
      const choice = confirm(
        `この予定は ${grpLen} 日間のグループ予定です。\n全日付を削除: OK　この日だけ削除: キャンセル`,
      );
      if (choice) {
        state.events = state.events.filter((e) => e.group_id !== groupId);
        cloudTasks = [() => deleteGroupCloud(groupId)];
      } else {
        if (!confirm("この日だけ削除しますか？")) return;
        state.events = state.events.filter((e) => e.id !== id);
        cloudTasks = [() => deleteEventCloud(id)];
      }
    } else {
      if (!confirm("この予定を削除しますか？")) return;
      state.events = state.events.filter((e) => e.id !== id);
      cloudTasks = [() => deleteEventCloud(id)];
    }

    // ② UI先に更新
    eventModal.close();
    render();
    // ③ クラウドは後で
    syncLater(cloudTasks);
  } catch (err) {
    alert("削除に失敗しました: " + err.message);
  }
});
