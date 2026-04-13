/**
 * timetable.js — 時間割ビュー
 *
 * Grid: 7 days × N periods (6 or 7, from localStorage "maxPeriod")
 * DB: calendar_timetable (id, user_id, day_of_week 0–6, period 1–N, subject, icon_key)
 * State: in-memory Map keyed by "dow-period"
 */

import { state } from "./state.js";
import { db as supabaseClient, tables } from "/common/supabase_config.js";
import { getIcon } from "/common/icons.js";

// ── Constants ────────────────────────────────────────────────
const DAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

// Subjects with suggested icon mappings
// icon_key uses Bootstrap Icon names (bi-*) from icons.js
const SUBJECT_ICON_MAP = {
  数学: "bi-calculator",
  英語: "bi-translate",
  国語: "bi-book",
  世界史: "bi-globe",
  地理: "bi-geo-alt",
  物理: "bi-lightning",
  化学: "bi-flask",
  生物: "bi-leaf",
  体育: "bi-bicycle",
  音楽: "bi-music-note",
  美術: "bi-palette",
  情報: "bi-laptop",
  家庭: "bi-house",
  政治経済: "bi-bank",
  倫理: "bi-lightbulb",
  自習: "bi-pencil",
  LHR: "bi-people",
  総合: "bi-grid",
};

// ── In-memory state ──────────────────────────────────────────
// Map<"dow-period", {id, subject, icon_key}>
let cells = new Map();
// ── グローバル変数に _loadStartTime を追加 ──
let _loadStartTime = 0;
let isLoading = false;

function cellKey(dow, period) {
  return `${dow}-${period}`;
}

function getMaxPeriod() {
  return parseInt(localStorage.getItem("maxPeriod") || "6", 10);
}

// ── Supabase helpers ──────────────────────────────────────────
// isLoading フラグの活用を強化
async function loadTimetable() {
  if (!supabaseClient || !state.user) return;
  if (isLoading) return; // ← 追加：二重呼び出し防止
  isLoading = true;
  _loadStartTime = Date.now();
  renderGrid();

  try {
    // ← try/finally で確実にフラグリセット
    const { data, error } = await supabaseClient
      .from(tables.CALENDAR_TIMETABLE)
      .select("id, day_of_week, period, subject, icon_key")
      .eq("user_id", state.user.id);

    if (error) throw error;

    cells.clear();
    for (const row of data || []) {
      cells.set(cellKey(row.day_of_week, row.period), {
        id: row.id,
        subject: row.subject || "",
        icon_key: row.icon_key || "",
      });
    }
  } catch (err) {
    console.error("Timetable load error:", err.message);
    alert("時間割の読み込みに失敗しました: " + err.message);
  } finally {
    isLoading = false;
    _loadStartTime = 0;
    renderGrid();
  }
}

async function saveTimetableCell(dow, period, subject, icon_key) {
  if (!supabaseClient || !state.user) return null;
  const key = cellKey(dow, period);
  const existing = cells.get(key);

  if (!subject.trim()) {
    // Delete
    if (existing?.id) {
      const { error } = await supabaseClient
        .from(tables.CALENDAR_TIMETABLE)
        .delete()
        .eq("id", existing.id);
      if (error) throw error;
    }
    cells.delete(key);
    return null;
  }

  const payload = {
    user_id: state.user.id,
    day_of_week: dow,
    period,
    subject: subject.trim(),
    icon_key: icon_key || null,
  };

  if (existing?.id) {
    // Update
    const { data, error } = await supabaseClient
      .from(tables.CALENDAR_TIMETABLE)
      .update({ subject: payload.subject, icon_key: payload.icon_key })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) throw error;
    cells.set(key, {
      id: existing.id,
      subject: payload.subject,
      icon_key: payload.icon_key,
    });
    return existing.id;
  } else {
    // Insert
    const { data, error } = await supabaseClient
      .from(tables.CALENDAR_TIMETABLE)
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    cells.set(key, {
      id: data.id,
      subject: payload.subject,
      icon_key: payload.icon_key,
    });
    return data.id;
  }
}

// ── Popover editor ────────────────────────────────────────────
let activePopover = null;

function onOutsideClick(e) {
  if (activePopover && !activePopover.contains(e.target)) {
    closePopover();
  }
}

function closePopover() {
  if (activePopover) {
    activePopover._backdrop?.remove();
    activePopover.remove();
    activePopover = null;
  }
  document.removeEventListener("click", onOutsideClick);
}

function openCellEditor(cellEl, dow, period) {
  closePopover();
  const key = cellKey(dow, period);
  const current = cells.get(key) || { subject: "", icon_key: "" };

  const popover = document.createElement("div");
  popover.className = "tt-popover";
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-label", "科目を編集");

  // Suggested icons for the subject
  const suggestIcons = Object.entries(SUBJECT_ICON_MAP)
    .slice(0, 8)
    .map(([label, iconName]) => {
      const svg = getIcon(iconName);
      return svg
        ? `<button type="button" class="tt-icon-btn" data-icon="${iconName}" title="${label}">${svg}</button>`
        : "";
    })
    .join("");

  // Build icon options from available subjects
  const iconOptions = Object.entries(SUBJECT_ICON_MAP)
    .map(([label, iconName]) => {
      const svg = getIcon(iconName);
      if (!svg) return "";
      return `<button type="button" class="tt-icon-btn${current.icon_key === iconName ? " selected" : ""}" data-icon="${iconName}" title="${label}">${svg}</button>`;
    })
    .join("");

  // 既存の科目一覧を収集（重複排除・空除外）
  const usedSubjects = [...new Set(
    [...cells.values()]
      .map((c) => c.subject)
      .filter(Boolean)
  )];

  const usedSubjectChips = usedSubjects.length
    ? `<div class="tt-popover-label" style="margin-bottom:4px;">登録済みの科目</div>
       <div class="tt-used-subjects">
         ${usedSubjects.map((s) => `<button type="button" class="tt-subject-chip" data-subject="${s}">${s}</button>`).join("")}
       </div>`
    : "";
  const maxPeriod = getMaxPeriod();
  const dayOptions = DAY_LABELS.map((label, i) =>
    `<option value="${i}"${i === dow ? " selected" : ""}>${label}</option>`
  ).join("");
  const periodOptions = Array.from({ length: maxPeriod }, (_, i) =>
    `<option value="${i + 1}"${i + 1 === period ? " selected" : ""}>${i + 1}限</option>`
  ).join("");

  popover.innerHTML = `
    <form class="tt-popover-form" autocomplete="off">
      <div class="tt-popover-header">
        <div class="tt-cell-selector">
          <select class="tt-select" id="tt-sel-dow">${dayOptions}</select>
          <select class="tt-select" id="tt-sel-period">${periodOptions}</select>
        </div>
        <button type="button" class="tt-popover-close">✕</button>
      </div>
      <label class="tt-popover-label">
        科目名
        <input
          type="text"
          class="tt-popover-input"
          value="${current.subject}"
          placeholder="例: 数学"
          list="tt-subject-list"
          maxlength="20"
          autofocus
        />
        <datalist id="tt-subject-list">
          ${Object.keys(SUBJECT_ICON_MAP)
      .map((s) => `<option value="${s}">`)
      .join("")}
        </datalist>
      </label>
      ${usedSubjectChips}
      <div class="tt-icon-grid">
        ${iconOptions}
      </div>
      <div class="tt-popover-actions">
        <button type="button" class="tt-btn-cancel">Cancel</button>
        <button type="button" class="tt-btn-clear">clear</button>
        <button type="submit" class="tt-btn-save primary">save</button>
      </div>
    </form>
  `;

  // 中央固定
  popover.style.position = "fixed";
  popover.style.left = "50%";
  popover.style.top = "50%";
  popover.style.transform = "translate(-50%, -50%)";

  // backdrop
  const backdrop = document.createElement("div");
  backdrop.className = "tt-popover-backdrop";
  backdrop.addEventListener("click", closePopover);
  document.body.appendChild(backdrop);
  document.body.appendChild(popover);
  activePopover = popover;
  activePopover._backdrop = backdrop;

  // Auto-suggest icon when subject typed
  const input = popover.querySelector(".tt-popover-input");
  let selectedIcon = current.icon_key || "";

  function updateSelectedIcon(iconName) {
    selectedIcon = iconName;
    popover.querySelectorAll(".tt-icon-btn").forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.icon === iconName);
    });
  }

  input.addEventListener("input", () => {
    const val = input.value.trim();
    const suggested = SUBJECT_ICON_MAP[val];
    if (suggested) updateSelectedIcon(suggested);
  });

  // 登録済み科目チップのクリックで入力欄に反映
  popover.querySelectorAll(".tt-subject-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      input.value = chip.dataset.subject;
      const suggested = SUBJECT_ICON_MAP[chip.dataset.subject];
      if (suggested) updateSelectedIcon(suggested);
      input.focus();
    });
  });

  popover.querySelectorAll(".tt-icon-btn").forEach((btn) => {
    btn.addEventListener("click", () => updateSelectedIcon(btn.dataset.icon));
  });

  popover
    .querySelector(".tt-btn-cancel")
    .addEventListener("click", closePopover);


  // 閉じるボタン
  popover.querySelector(".tt-popover-close").addEventListener("click", closePopover);

  // 曜日・時限セレクター変更 → ターゲットセルを切り替え
  let currentDow = dow;
  let currentPeriod = period;

  popover.querySelector("#tt-sel-dow").addEventListener("change", (e) => {
    currentDow = parseInt(e.target.value);
    const k = cellKey(currentDow, currentPeriod);
    const c = cells.get(k) || { subject: "", icon_key: "" };
    input.value = c.subject;
    updateSelectedIcon(c.icon_key || "");
  });

  popover.querySelector("#tt-sel-period").addEventListener("change", (e) => {
    currentPeriod = parseInt(e.target.value);
    const k = cellKey(currentDow, currentPeriod);
    const c = cells.get(k) || { subject: "", icon_key: "" };
    input.value = c.subject;
    updateSelectedIcon(c.icon_key || "");
  });

  // saveとclearのターゲットをcurrentDow/currentPeriodに差し替え
  popover.querySelector(".tt-btn-clear").addEventListener("click", async () => {
    closePopover();
    try {
      await saveTimetableCell(currentDow, currentPeriod, "", "");
      renderGrid();
    } catch (err) {
      alert("削除に失敗しました: " + err.message);
    }
  });

  popover.querySelector(".tt-popover-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const subject = input.value.trim();
    closePopover();
    try {
      await saveTimetableCell(currentDow, currentPeriod, subject, selectedIcon);
      renderGrid();
    } catch (err) {
      alert("保存に失敗しました: " + err.message);
    }
  });

  // Focus input
  input.focus();
  input.select();
}

// ── Grid render ───────────────────────────────────────────────
function renderGrid() {
  const root = document.getElementById("timetable-root");
  if (!root) return;
  const maxPeriod = getMaxPeriod();

  document.documentElement.style.setProperty(
    "--tt-max-period",
    String(maxPeriod),
  );

  if (isLoading) {
    root.innerHTML = `<div class="tt-loading">
      <span class="loading-spinner"></span>
      <span>読み込み中…</span>
    </div>`;
    return;
  }

  if (!state.user) {
    root.innerHTML = `<div class="tt-empty">ログインすると時間割を保存できます。</div>`;
    return;
  }

  // Build header row: empty corner + day labels
  const headerCells =
    `<div class="tt-corner"></div>` +
    DAY_LABELS.map((label, i) => {
      const isWeekend = i >= 5;
      return `<div class="tt-day-header${isWeekend ? " tt-weekend" : ""}">${label}</div>`;
    }).join("");

  // Build period rows
  let rows = "";
  for (let p = 1; p <= maxPeriod; p++) {
    let rowCells = `<div class="tt-period-header">${p}</div>`;
    for (let d = 0; d < 7; d++) {
      const key = cellKey(d, p);
      const cell = cells.get(key);
      const isWeekend = d >= 5;

      if (cell?.subject) {
        const iconSvg = cell.icon_key ? getIcon(cell.icon_key) : "";
        rowCells += `
          <div class="tt-cell tt-cell--filled${isWeekend ? " tt-weekend" : ""}"
               data-dow="${d}" data-period="${p}"
               title="${cell.subject}">
            ${iconSvg ? `<span class="tt-cell-icon">${iconSvg}</span>` : ""}
            <span class="tt-cell-label">${cell.subject}</span>
          </div>`;
      } else {
        rowCells += `
          <div class="tt-cell tt-cell--empty${isWeekend ? " tt-weekend" : ""}"
               data-dow="${d}" data-period="${p}"
               title="クリックして科目を追加">
            <span class="tt-cell-add">+</span>
          </div>`;
      }
    }
    rows += `<div class="tt-row">${rowCells}</div>`;
  }

  root.innerHTML = `
    <div class="tt-wrap">
      <div class="tt-grid" style="--tt-cols: ${7}">
        <div class="tt-header-row">${headerCells}</div>
        ${rows}
      </div>
    </div>
  `;

  // Attach click handlers
  root.querySelectorAll(".tt-cell").forEach((cellEl) => {
    cellEl.addEventListener("click", () => {
      const dow = parseInt(cellEl.dataset.dow, 10);
      const period = parseInt(cellEl.dataset.period, 10);
      openCellEditor(cellEl, dow, period);
    });
  });
}

// ── Init ──────────────────────────────────────────────────────
// ── 既存の initTimetable() を以下に置き換え ──

export function initTimetable() {
  renderGrid();
  if (state.user) loadTimetable();

  window.addEventListener("maxperiod-change", () => renderGrid());

  // タブ復帰時に再フェッチ（isLoadingがtrueで固まったケースのリカバリも兼ねる）
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.user) {
      // isLoadingが60秒以上 true のままなら強制リセット
      if (isLoading) {
        const now = Date.now();
        if (!_loadStartTime || now - _loadStartTime > 60_000) {
          isLoading = false;
        } else {
          return; // 正常なロード中
        }
      }
      loadTimetable();
    }
  });
}

export function refreshTimetable() {
  if (!state.user) {
    cells.clear();
    isLoading = false;
    renderGrid();
    return;
  }
  loadTimetable();
}
