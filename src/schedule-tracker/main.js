import { db, tables } from "/common/supabase_config.js";

const TABLE = tables.WEEKLY_SCHEDULE;
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

// ============================================================
// STATE
// ============================================================
let user = null;
let slots = [];
let viewDay = new Date().getDay(); // sidebar / mobile settings preview
let addDays = new Set([new Date().getDay()]); // add-form multi-select
let selColor = COLORS[0];
let notifTimers = [];
let clockTick = null;
let isSignup = false;
let editingId = null; // null = 追加モード、uuid = 編集モード

// ============================================================
// UTILITIES
// ============================================================
function timeToFloat(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h + m / 60;
}
function floatToHHMM(f) {
  const ff = f >= 24 ? f - 24 : f;
  const h = Math.floor(ff);
  const m = Math.round((ff - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function nowHour() {
  const n = new Date();
  return n.getHours() + n.getMinutes() / 60 + n.getSeconds() / 3600;
}
function isOvernightSlot(s) {
  return s.end_hour < s.start_hour;
}
function isCurrentSlot(s, ch) {
  return isOvernightSlot(s)
    ? ch >= s.start_hour || ch < s.end_hour
    : ch >= s.start_hour && ch < s.end_hour;
}
function isPastSlot(s, ch) {
  return isOvernightSlot(s) ? false : ch >= s.end_hour;
}
function isDesktop() {
  return window.innerWidth >= 768;
}

function overnightTag() {
  return '<span class="overnight-badge">翌日まで</span>';
}

// ============================================================
// TODAY'S SLOTS
// ============================================================
function getTodaySlots() {
  const today = new Date().getDay();
  const yesterday = (today + 6) % 7;
  const own = slots.filter((s) => s.day_of_week === today);
  const prev = slots.filter(
    (s) => s.day_of_week === yesterday && isOvernightSlot(s),
  );
  return [...prev, ...own].sort((a, b) => {
    const aS = prev.includes(a) ? 0 : a.start_hour;
    const bS = prev.includes(b) ? 0 : b.start_hour;
    return aS - bS;
  });
}

// ============================================================
// SVG CHART
// ============================================================
function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function h2deg(hour) {
  return (hour / 24) * 360 - 90;
}
function arcPath(cx, cy, R, r, h0, h1) {
  const a0 = h2deg(h0),
    a1 = h2deg(h1);
  let span = a1 - a0;
  if (span <= 0) span += 360;
  const lg = span > 180 ? 1 : 0;
  const p = (cx, cy, R, a) => {
    const pt = polar(cx, cy, R, a);
    return `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`;
  };
  return `M ${p(cx, cy, R, a0)} A ${R} ${R} 0 ${lg} 1 ${p(cx, cy, R, a1)} L ${p(cx, cy, r, a1)} A ${r} ${r} 0 ${lg} 0 ${p(cx, cy, r, a0)} Z`;
}

function drawChart(daySlots) {
  const svg = document.getElementById("schedule-chart");
  const cx = 140,
    cy = 140,
    R = 118,
    r = 72;
  let html = "";

  html += `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="#e8e8e5" stroke-width="${R - r}"/>`;
  for (const s of daySlots) {
    html += `<path d="${arcPath(cx, cy, R, r, s.start_hour, s.end_hour)}" fill="${s.color}" opacity="0.9"/>`;
  }
  [0, 6, 12, 18].forEach((h) => {
    const deg = h2deg(h);
    const p1 = polar(cx, cy, R + 5, deg),
      p2 = polar(cx, cy, R + 13, deg),
      pt = polar(cx, cy, R + 22, deg);
    html += `<line x1="${p1.x.toFixed(2)}" y1="${p1.y.toFixed(2)}" x2="${p2.x.toFixed(2)}" y2="${p2.y.toFixed(2)}" stroke="#bbb" stroke-width="1.5" stroke-linecap="round"/>`;
    html += `<text x="${pt.x.toFixed(2)}" y="${pt.y.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" font-size="9" fill="#999" font-family="JetBrains Mono,monospace">${h}</text>`;
  });
  html += `<line id="chart-hand" x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy}" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round"/>`;
  html += `<circle cx="${cx}" cy="${cy}" r="4" fill="#1a1a1a"/>`;
  svg.innerHTML = html;
  updateHand();
}

function updateHand() {
  const hand = document.getElementById("chart-hand");
  if (!hand) return;
  const p = polar(140, 140, 110, h2deg(nowHour()));
  hand.setAttribute("x2", p.x.toFixed(2));
  hand.setAttribute("y2", p.y.toFixed(2));
}

// ============================================================
// CLOCK & CURRENT EVENT
// ============================================================
function updateClock() {
  const now = new Date();
  document.getElementById("clock-time").textContent = now.toLocaleTimeString(
    "ja-JP",
    { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false },
  );
  document.getElementById("clock-date").textContent =
    `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日（${WEEKDAY_NAMES[now.getDay()]}）`;

  const ch = nowHour();
  const todayAll = getTodaySlots();
  const current = todayAll.find((s) => isCurrentSlot(s, ch));
  const next = todayAll.find(
    (s) => !isCurrentSlot(s, ch) && !isPastSlot(s, ch) && s.start_hour > ch,
  );

  const bar = document.getElementById("current-event-bar");
  const dot = bar.querySelector(".event-indicator");
  const lbl = document.getElementById("event-label");
  const tim = document.getElementById("event-time");
  const nxt = document.getElementById("event-next");

  if (current) {
    bar.className = "current-event-bar";
    bar.style.borderColor = current.color;
    bar.style.background = current.color + "18";
    dot.style.background = current.color;
    lbl.innerHTML =
      current.label + (isOvernightSlot(current) ? overnightTag() : "");
    tim.textContent = `${floatToHHMM(current.start_hour)} — ${floatToHHMM(current.end_hour)}`;
    nxt.textContent = next
      ? `次: ${next.label}  ${floatToHHMM(next.start_hour)}〜`
      : "";
  } else {
    bar.className = "current-event-bar empty";
    bar.style.borderColor = "";
    bar.style.background = "";
    dot.style.background = "";
    lbl.innerHTML = "予定なし";
    tim.textContent = "";
    nxt.textContent = next
      ? `次: ${next.label}  ${floatToHHMM(next.start_hour)}〜`
      : "";
  }

  if (now.getSeconds() === 0) drawChart(todayAll);
  else updateHand();
}

// ============================================================
// SIDEBAR RENDER (desktop)
// ============================================================
function renderSidebar() {
  const today = new Date().getDay();
  const ch = nowHour();

  // Day grid
  document.getElementById("sb-day-grid").innerHTML = DAYS.map(
    (d, i) => `
    <button class="sd-pill ${i === viewDay ? "selected" : ""} ${i === today ? "today" : ""}" data-day="${i}">${d}</button>
  `,
  ).join("");
  document.querySelectorAll(".sd-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      viewDay = Number(btn.dataset.day);
      renderSidebar();
      renderMobileSettings();
    });
  });

  // Label
  const label =
    viewDay === today ? "今日の予定" : `${WEEKDAY_NAMES[viewDay]}の予定`;
  document.getElementById("sb-day-label").textContent = label;

  // Slot list
  const daySlots = (
    viewDay === today
      ? getTodaySlots()
      : slots.filter((s) => s.day_of_week === viewDay)
  ).sort((a, b) => a.start_hour - b.start_hour);

  const el = document.getElementById("sb-slots");
  if (daySlots.length === 0) {
    el.innerHTML = `<p class="sb-empty">予定なし</p>`;
    return;
  }

  el.innerHTML = daySlots
    .map((s) => {
      const isCurrent = viewDay === today && isCurrentSlot(s, ch);
      const isPast = viewDay === today && isPastSlot(s, ch);
      const oTag = isOvernightSlot(s) ? overnightTag() : "";
      return `
      <div class="sb-slot ${isCurrent ? "is-current" : isPast ? "is-past" : ""}"
           style="--slot-c:${s.color}; border-left-color:${s.color}">
        <div class="sb-slot-info">
          <div class="sb-slot-label">${s.label}${oTag}</div>
          <div class="sb-slot-time">${floatToHHMM(s.start_hour)}–${floatToHHMM(s.end_hour)}</div>
        </div>
        <button class="btn-icon" data-edit-id="${s.id}" title="編集" style="width:24px;height:24px;padding:2px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="btn-icon danger" data-id="${s.id}" title="削除" style="width:24px;height:24px;padding:2px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
          </svg>
        </button>
      </div>`;
    })
    .join("");

  el.querySelectorAll("[data-edit-id]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const slot = slots.find((s) => s.id === btn.dataset.editId);
      if (slot) startEdit(slot);
    }),
  );
  el.querySelectorAll(".btn-icon.danger").forEach((btn) =>
    btn.addEventListener("click", () => deleteSlot(btn.dataset.id)),
  );
}

// ============================================================
// MOBILE TODAY LIST (display tab)
// ============================================================
function renderMobileTodayList() {
  const ch = nowHour();
  const todayAll = getTodaySlots();
  const el = document.getElementById("mobile-today-list");

  if (todayAll.length === 0) {
    el.innerHTML = `<div class="empty-state">今日の予定はありません<br>設定タブから追加できます</div>`;
    return;
  }
  el.innerHTML = todayAll
    .map((s) => {
      const oTag = isOvernightSlot(s) ? overnightTag() : "";
      return `
      <div class="slot-card ${isCurrentSlot(s, ch) ? "is-current" : isPastSlot(s, ch) ? "is-past" : ""}"
           style="--slot-c:${s.color}; border-left-color:${s.color}">
        <span class="slot-card-label">${s.label}${oTag}</span>
        <span class="slot-card-time">${floatToHHMM(s.start_hour)}–${floatToHHMM(s.end_hour)}</span>
      </div>`;
    })
    .join("");
}

// ============================================================
// MOBILE SETTINGS SLOT LIST
// ============================================================
function renderMobileSettings() {
  const today = new Date().getDay();

  // Day pills
  document.getElementById("mobile-day-pills").innerHTML = DAYS.map(
    (d, i) => `
    <button class="day-pill ${i === viewDay ? "selected" : ""} ${i === today ? "today" : ""}" data-day="${i}">${d}</button>
  `,
  ).join("");
  document.querySelectorAll("#mobile-day-pills .day-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      viewDay = Number(btn.dataset.day);
      renderMobileSettings();
      renderSidebar();
    });
  });

  // Slot list
  const daySlots = slots
    .filter((s) => s.day_of_week === viewDay)
    .sort((a, b) => a.start_hour - b.start_hour);
  const el = document.getElementById("mobile-slot-list");

  if (daySlots.length === 0) {
    el.innerHTML = `<div class="empty-state" style="padding:.75rem 0">この曜日に予定はありません</div>`;
    return;
  }
  el.innerHTML = daySlots
    .map((s) => {
      const oTag = isOvernightSlot(s) ? overnightTag() : "";
      return `
      <div class="settings-slot-item" style="--slot-c:${s.color}; border-left-color:${s.color}; margin-bottom:.3rem">
        <div class="settings-slot-info">
          <div class="settings-slot-label">${s.label}${oTag}</div>
          <div class="settings-slot-time">${floatToHHMM(s.start_hour)} — ${floatToHHMM(s.end_hour)}</div>
        </div>
        <button class="btn-icon" data-edit-id="${s.id}" title="編集">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="btn-icon danger" data-id="${s.id}" title="削除">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
          </svg>
        </button>
      </div>`;
    })
    .join("");

  el.querySelectorAll("[data-edit-id]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const slot = slots.find((s) => s.id === btn.dataset.editId);
      if (slot) startEdit(slot);
    }),
  );
  el.querySelectorAll(".btn-icon.danger").forEach((btn) =>
    btn.addEventListener("click", () => deleteSlot(btn.dataset.id)),
  );
}

// ============================================================
// ADD-FORM DAY PILLS
// ============================================================
function renderAddDayPills() {
  const today = new Date().getDay();
  document.getElementById("add-day-pills").innerHTML = DAYS.map(
    (d, i) => `
    <button class="day-pill ${addDays.has(i) ? "add-selected" : ""} ${i === today ? "today" : ""}" data-day="${i}">${d}</button>
  `,
  ).join("");
  document.querySelectorAll("#add-day-pills .day-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.day);
      if (addDays.has(i)) {
        if (addDays.size > 1) addDays.delete(i);
      } else addDays.add(i);
      document
        .querySelectorAll("#add-day-pills .day-pill")
        .forEach((b) =>
          b.classList.toggle(
            "add-selected",
            addDays.has(Number(b.dataset.day)),
          ),
        );
    });
  });
}

// ============================================================
// COLOR PICKER
// ============================================================
function renderColorPicker() {
  document.getElementById("color-picker").innerHTML = COLORS.map(
    (c) => `
    <div class="color-swatch ${c === selColor ? "selected" : ""}"
         style="background:${c}" data-color="${c}" tabindex="0" role="button" aria-label="${c}"></div>
  `,
  ).join("");
  document.querySelectorAll(".color-swatch").forEach((sw) => {
    const pick = () => {
      selColor = sw.dataset.color;
      document
        .querySelectorAll(".color-swatch")
        .forEach((s) => s.classList.remove("selected"));
      sw.classList.add("selected");
    };
    sw.addEventListener("click", pick);
    sw.addEventListener("keydown", (e) => e.key === "Enter" && pick());
  });
}

// ============================================================
// FULL RENDER
// ============================================================
function renderAll() {
  drawChart(getTodaySlots());
  renderSidebar();
  renderMobileTodayList();
  renderMobileSettings();
  renderAddDayPills();
  renderColorPicker();
}

// ============================================================
// EDIT MODE
// ============================================================
function startEdit(slot) {
  editingId = slot.id;
  selColor = slot.color;

  document.getElementById("in-start").value = floatToHHMM(slot.start_hour);
  document.getElementById("in-end").value = floatToHHMM(slot.end_hour);
  document.getElementById("in-label").value = slot.label;
  document.getElementById("in-notify").value = String(slot.notify_before);

  document.getElementById("add-form-title").textContent = "✎ 予定を編集";
  document.getElementById("btn-add").textContent = "更新";
  document.getElementById("btn-cancel-edit").style.display = "block";
  document.getElementById("add-day-pills-group").style.display = "none";
  document.querySelector(".add-form-card").classList.add("editing");
  document.getElementById("add-error").textContent = "";

  renderColorPicker();

  // 設定タブに移動してフォームまでスクロール
  switchTab("settings");
  setTimeout(() => {
    document
      .getElementById("add-form-title")
      .scrollIntoView({ behavior: "smooth", block: "start" });
  }, 80);
}

function cancelEdit() {
  editingId = null;
  selColor = COLORS[0];

  document.getElementById("in-start").value = "09:00";
  document.getElementById("in-end").value = "10:00";
  document.getElementById("in-label").value = "";
  document.getElementById("in-notify").value = "5";

  document.getElementById("add-form-title").textContent = "＋ 予定を追加";
  document.getElementById("btn-add").textContent = "追加";
  document.getElementById("btn-cancel-edit").style.display = "none";
  document.getElementById("add-day-pills-group").style.display = "";
  document.querySelector(".add-form-card").classList.remove("editing");
  document.getElementById("add-error").textContent = "";

  renderColorPicker();
  renderAddDayPills();
}

// ============================================================
// CRUD
// ============================================================
async function fetchSlots() {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .eq("user_id", user.id);
  if (error) {
    console.error("fetchSlots:", error.message);
    return;
  }
  slots = data || [];
}

async function addSlot() {
  const startVal = document.getElementById("in-start").value;
  const endVal = document.getElementById("in-end").value;
  const labelVal = document.getElementById("in-label").value.trim();
  const notifyVal = Number(document.getElementById("in-notify").value);
  const errEl = document.getElementById("add-error");
  errEl.textContent = "";

  if (!startVal || !endVal || !labelVal) {
    errEl.textContent = "全ての項目を入力してください";
    return;
  }
  const sh = timeToFloat(startVal),
    eh = timeToFloat(endVal);
  if (sh === eh) {
    errEl.textContent = "開始と終了が同じ時刻です";
    return;
  }

  const btn = document.getElementById("btn-add");
  btn.disabled = true;

  if (editingId) {
    // ── 編集モード: UPDATE ──
    btn.textContent = "更新中…";
    const { error } = await db
      .from(TABLE)
      .update({
        start_hour: sh,
        end_hour: eh,
        label: labelVal,
        color: selColor,
        notify_before: notifyVal,
      })
      .eq("id", editingId);

    btn.disabled = false;
    btn.textContent = "更新";
    if (error) {
      errEl.textContent = error.message;
      return;
    }

    cancelEdit();
  } else {
    // ── 追加モード: INSERT ──
    const daysArr = [...addDays];
    btn.textContent = `${daysArr.length}曜日に追加中…`;

    const { error } = await db.from(TABLE).insert(
      daysArr.map((d) => ({
        user_id: user.id,
        day_of_week: d,
        start_hour: sh,
        end_hour: eh,
        label: labelVal,
        color: selColor,
        notify_before: notifyVal,
      })),
    );

    btn.disabled = false;
    btn.textContent = "追加";
    if (error) {
      errEl.textContent = error.message;
      return;
    }

    document.getElementById("in-label").value = "";
  }

  await fetchSlots();
  renderAll();
  scheduleNotifs();
}

async function deleteSlot(id) {
  if (!confirm("この予定を削除しますか？")) return;
  const { error } = await db.from(TABLE).delete().eq("id", id);
  if (error) {
    alert("削除に失敗しました: " + error.message);
    return;
  }
  await fetchSlots();
  renderAll();
  scheduleNotifs();
}

// ============================================================
// NOTIFICATIONS
// ============================================================
function clearNotifTimers() {
  notifTimers.forEach((id) => clearTimeout(id));
  notifTimers = [];
}

function scheduleNotifs() {
  clearNotifTimers();
  if (!("Notification" in window) || Notification.permission !== "granted")
    return;
  const ch = nowHour(),
    today = new Date().getDay();
  slots
    .filter((s) => s.day_of_week === today)
    .forEach((s) => {
      const notifyH = s.start_hour - (s.notify_before || 5) / 60;
      const diffMs = (notifyH - ch) * 3600 * 1000;
      if (diffMs > 0) {
        notifTimers.push(
          setTimeout(() => {
            new Notification(`📅 ${s.label}`, {
              body: `${floatToHHMM(s.start_hour)} から始まります`,
            });
          }, diffMs),
        );
      }
    });
}

async function requestNotifPermission() {
  const perm = await Notification.requestPermission();
  document.getElementById("notif-banner").style.display = "none";
  document.getElementById("notif-banner-sb").style.display = "none";
  if (perm === "granted") scheduleNotifs();
}

function checkNotifBanner() {
  if (!("Notification" in window) || Notification.permission !== "default")
    return;
  if (isDesktop()) {
    document.getElementById("notif-banner-sb").style.display = "flex";
  } else {
    document.getElementById("notif-banner").style.display = "flex";
  }
}

// ============================================================
// AUTH
// ============================================================
async function handleSubmit() {
  const email = document.getElementById("email").value.trim();
  const pw = document.getElementById("password").value;
  const msgEl = document.getElementById("auth-msg");
  const btn = document.getElementById("btn-submit");
  msgEl.textContent = "";
  msgEl.className = "error-msg";
  btn.disabled = true;

  const result = isSignup
    ? await db.auth.signUp({ email, password: pw })
    : await db.auth.signInWithPassword({ email, password: pw });
  btn.disabled = false;

  if (result.error) {
    msgEl.textContent = result.error.message;
    return;
  }
  if (isSignup && !result.data.session) {
    msgEl.className = "success-msg";
    msgEl.textContent =
      "確認メールを送信しました。確認後ログインしてください。";
    return;
  }
  user = result.data.user;
  await bootApp();
}

// ============================================================
// BOOT
// ============================================================
async function bootApp() {
  await fetchSlots();
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("app").style.display = "flex";
  renderAll();
  checkNotifBanner();
  scheduleNotifs();
  updateClock();
  clockTick = setInterval(updateClock, 1000);
}

// ============================================================
// TAB SWITCHING
// ============================================================
function switchTab(name) {
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => el.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn, .navbar-tab")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById(`tab-${name}`).classList.add("active");
  document
    .querySelectorAll(`[data-tab="${name}"]`)
    .forEach((b) => b.classList.add("active"));
}

// ============================================================
// INIT
// ============================================================
document.addEventListener("DOMContentLoaded", async () => {
  // Tab switching (bottom bar + navbar tabs)
  document
    .querySelectorAll(".tab-btn, .navbar-tab")
    .forEach((btn) =>
      btn.addEventListener("click", () => switchTab(btn.dataset.tab)),
    );

  // Auth toggle
  document.getElementById("btn-mode-toggle").addEventListener("click", () => {
    isSignup = !isSignup;
    document.getElementById("auth-title").textContent = isSignup
      ? "新規登録"
      : "ログイン";
    document.getElementById("btn-submit").textContent = isSignup
      ? "登録する"
      : "ログイン";
    document.getElementById("btn-mode-toggle").textContent = isSignup
      ? "ログイン"
      : "新規登録";
    document.getElementById("auth-toggle-text").textContent = isSignup
      ? "すでにアカウントをお持ちの方は"
      : "アカウントをお持ちでない方は";
    document.getElementById("auth-msg").textContent = "";
  });

  document.getElementById("btn-submit").addEventListener("click", handleSubmit);
  document
    .getElementById("password")
    .addEventListener("keydown", (e) => e.key === "Enter" && handleSubmit());

  document.getElementById("btn-signout").addEventListener("click", async () => {
    clearInterval(clockTick);
    clearNotifTimers();
    await db.auth.signOut();
    user = null;
    slots = [];
    document.getElementById("app").style.display = "none";
    document.getElementById("auth-screen").style.display = "flex";
  });

  document
    .getElementById("btn-allow-notif")
    .addEventListener("click", requestNotifPermission);
  document
    .getElementById("btn-allow-notif-sb")
    .addEventListener("click", requestNotifPermission);
  document.getElementById("btn-add").addEventListener("click", addSlot);
  document
    .getElementById("btn-cancel-edit")
    .addEventListener("click", cancelEdit);

  // Restore session
  const {
    data: { session },
  } = await db.auth.getSession();
  if (session) {
    user = session.user;
    await bootApp();
  }
});
