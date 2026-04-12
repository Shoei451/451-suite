export const $ = (sel, ctx = document) => ctx.querySelector(sel);
export const uid = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);
export const escapeHtml = (s) =>
  (s || "").replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        m
      ],
  );

export function formatDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// カテゴリ → CSS変数キー（tokens.cssの --cat-{key}-bg / --cat-{key}-fg に対応）
export const CATEGORY_CSS_KEY = {
  課題提出日: "submission",
  試験: "exam",
  "定期試験 / 学校模試": "formal-exam",
  東進模試: "toshin",
  時程変更: "schedule",
  部活動: "club",
  長期休み: "holiday",
  その他: "other",
};

// カテゴリ → Bootstrap Iconsアイコン名
export const CATEGORY_ICON = {
  課題提出日: "bi-journal-check",
  試験: "bi-pencil-square",
  "定期試験 / 学校模試": "bi-clipboard2-check",
  東進模試: "bi-building",
  時程変更: "bi-arrow-repeat",
  部活動: "bi-trophy",
  長期休み: "bi-sun",
  その他: "bi-three-dots",
};

export const NO_COURSE_TYPES = ["時程変更", "部活動", "長期休み", "その他"];

export const state = {
  events: [],
  user: null,
  isOffline: false,
  isAuthMode: "login",
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
  filterCourse: "",
  filterType: "",
};
