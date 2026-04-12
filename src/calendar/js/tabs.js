/**
 * tabs.js — Tab navigation + month navigator
 *
 * Tabs: calendar | dashboard | timetable | settings
 * State: URL hash (#calendar etc.), falls back to #calendar
 * Month nav: slide animation, swipe on mobile
 */

import { state } from "./state.js";
import { render } from "./render.js";

// ── Constants ────────────────────────────────────────────────
const VALID_TABS = ["calendar", "dashboard", "timetable", "settings"];

const MONTH_NAMES_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// ── Elements ─────────────────────────────────────────────────
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");
const monthLabel = document.getElementById("monthLabel");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const calendarNav = document.getElementById("calendarNav"); // month nav bar

// ── Tab activation ───────────────────────────────────────────
export function activateTab(name) {
  const tab = VALID_TABS.includes(name) ? name : "calendar";

  // Update buttons
  tabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
    btn.setAttribute("aria-selected", btn.dataset.tab === tab);
  });

  // Update panels
  tabPanels.forEach((panel) => {
    const isActive = panel.dataset.panel === tab;
    panel.hidden = !isActive;
    panel.classList.toggle("active", isActive);
  });

  // Show/hide month nav (calendar only)
  if (calendarNav) {
    calendarNav.hidden = tab !== "calendar";
  }
}

function currentTab() {
  const hash = location.hash.slice(1);
  return VALID_TABS.includes(hash) ? hash : "calendar";
}

// ── Month nav ─────────────────────────────────────────────────
function updateMonthLabel(direction = null) {
  if (!monthLabel) return;

  const newText = `${MONTH_NAMES_EN[state.month]} ${state.year}`;

  if (!direction) {
    monthLabel.textContent = newText;
    return;
  }

  // 進行中のアニメーションを即座にキャンセル
  monthLabel.classList.remove(
    "slide-out-left",
    "slide-out-right",
    "slide-in-left",
    "slide-in-right",
  );
  // 強制リフロー（クラス削除を確定させる）
  void monthLabel.offsetWidth;

  const outClass = direction === "next" ? "slide-out-left" : "slide-out-right";
  const inClass = direction === "next" ? "slide-in-right" : "slide-in-left";

  monthLabel.classList.add(outClass);
  monthLabel.addEventListener(
    "animationend",
    () => {
      monthLabel.classList.remove(outClass);
      monthLabel.textContent = newText;
      monthLabel.classList.add(inClass);
      monthLabel.addEventListener(
        "animationend",
        () => monthLabel.classList.remove(inClass),
        { once: true },
      );
    },
    { once: true },
  );
}

function goToPrev() {
  const d = new Date(state.year, state.month - 1, 1);
  state.year = d.getFullYear();
  state.month = d.getMonth();
  updateMonthLabel("prev");
  render();
}

function goToNext() {
  const d = new Date(state.year, state.month + 1, 1);
  state.year = d.getFullYear();
  state.month = d.getMonth();
  updateMonthLabel("next");
  render();
}

function goToToday() {
  const now = new Date();
  const wasToday =
    state.year === now.getFullYear() && state.month === now.getMonth();
  if (wasToday) return;
  const direction =
    new Date(state.year, state.month) <
    new Date(now.getFullYear(), now.getMonth())
      ? "next"
      : "prev";
  state.year = now.getFullYear();
  state.month = now.getMonth();
  state.filterCourse = "";
  state.filterType = "";
  updateMonthLabel(direction);
  render();
}

// ── Swipe detection (mobile) ─────────────────────────────────
let touchStartX = 0;
const SWIPE_THRESHOLD = 50;

const calendarEl = document.getElementById("calendar");
if (calendarEl) {
  calendarEl.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.touches[0].clientX;
    },
    { passive: true },
  );

  calendarEl.addEventListener(
    "touchend",
    (e) => {
      const delta = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(delta) < SWIPE_THRESHOLD) return;
      if (delta < 0) goToNext();
      else goToPrev();
    },
    { passive: true },
  );
}

// ── Event listeners ──────────────────────────────────────────
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    location.hash = btn.dataset.tab;
  });
});

window.addEventListener("hashchange", () => {
  activateTab(currentTab());
});

if (prevBtn) prevBtn.addEventListener("click", goToPrev);
if (nextBtn) nextBtn.addEventListener("click", goToNext);

// Click on label → jump to today
if (monthLabel) monthLabel.addEventListener("click", goToToday);

// ── Init ─────────────────────────────────────────────────────
export function initTabs() {
  updateMonthLabel(null);
  activateTab(currentTab()); // ← これが calendarNav.hidden を設定する
}
