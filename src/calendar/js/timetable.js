/**
 * timetable.js — 時間割ビュー
 *
 * Grid: 7 days × N periods (6 or 7, from localStorage "maxPeriod")
 * DB: calendar_timetable (id, user_id, day_of_week 0–6, period 1–N, subject, icon_key)
 * State: in-memory Map keyed by "dow-period"
 */

import { state } from "./state.js";
import { db as supabaseClient, tables } from "/common/supabase_config.js";
import { getIcon } from "./icons.js";

// ── Constants ────────────────────────────────────────────────
const DAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

// Subjects with suggested icon mappings
// icon_key uses Bootstrap Icon names (bi-*) from icons.js
const SUBJECT_ICON_MAP = {
  数学: "bi-calculator",
  英語: "bi-translate",
  国語: "bi-book",
  現代文: "bi-book",
  古典: "bi-book",
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
  HR: "bi-people",
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
  if (!popover.contains(e.target) && e.target !== cellEl) {
    closePopover();
    document.removeEventListener("click", onOutsideClick);
  }
}

// closePopover に onOutsideClick の削除を追加
function closePopover() {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
  }
  document.removeEventListener("click", onOutsideClick); // ← 追加
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

  popover.innerHTML = `
    <form class="tt-popover-form" autocomplete="off">
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
      <div class="tt-icon-grid">
        ${iconOptions}
      </div>
      <div class="tt-popover-actions">
        <button type="button" class="tt-btn-cancel">キャンセル</button>
        <button type="button" class="tt-btn-clear">クリア</button>
        <button type="submit" class="tt-btn-save primary">保存</button>
      </div>
    </form>
  `;

  // Position near the cell
  const rect = cellEl.getBoundingClientRect();
  const scrollY = window.scrollY;
  popover.style.position = "absolute";

  document.body.appendChild(popover);
  activePopover = popover;

  // Adjust position after render
  const pw = popover.offsetWidth;
  const ph = popover.offsetHeight;
  const vw = window.innerWidth;

  let left = rect.left + window.scrollX;
  let top = rect.bottom + scrollY + 4;

  if (left + pw > vw - 8) left = vw - pw - 8;
  if (left < 8) left = 8;
  if (top + ph > scrollY + window.innerHeight - 8) {
    top = rect.top + scrollY - ph - 4;
  }

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;

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

  popover.querySelectorAll(".tt-icon-btn").forEach((btn) => {
    btn.addEventListener("click", () => updateSelectedIcon(btn.dataset.icon));
  });

  popover
    .querySelector(".tt-btn-cancel")
    .addEventListener("click", closePopover);

  popover.querySelector(".tt-btn-clear").addEventListener("click", async () => {
    closePopover();
    try {
      await saveTimetableCell(dow, period, "", "");
      renderGrid();
    } catch (err) {
      alert("削除に失敗しました: " + err.message);
    }
  });

  popover
    .querySelector(".tt-popover-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const subject = input.value.trim();
      closePopover();
      try {
        await saveTimetableCell(dow, period, subject, selectedIcon);
        renderGrid();
      } catch (err) {
        alert("保存に失敗しました: " + err.message);
      }
    });

  // Close on outside click
  setTimeout(() => {
    document.addEventListener("click", onOutsideClick);
  }, 0);

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
