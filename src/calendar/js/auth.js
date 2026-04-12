import { supabaseClient } from "./config.js";
import { state } from "./state.js";
import {
  loadRemoteEvents,
  subscribeRealtime,
  unsubscribeRealtime,
  setSyncStatus,
} from "./cloud.js";
import { render } from "./render.js";
import { refreshTimetable } from "./timetable.js";

const authScreen = document.getElementById("authScreen");
const mainApp = document.getElementById("mainApp");
const authForm = document.getElementById("authForm");
const authError = document.getElementById("authError");
const authSubmit = document.getElementById("authSubmit");
const authToggleBtn = document.getElementById("authToggleBtn");
const authToggleText = document.getElementById("authToggleText");
const logoutBtn = document.getElementById("logoutBtn");
const offlineBtn = document.getElementById("offlineBtn");
const userInfoBox = document.getElementById("userInfoBox");
const userEmailEl = document.getElementById("userEmail");

export function showApp(userObj) {
  state.user = userObj || null;
  authScreen.style.display = "none";
  mainApp.classList.add("visible");
  if (userObj) {
    userInfoBox.style.display = "";
    userEmailEl.textContent = userObj.email || "";
    logoutBtn.style.display = "";
  } else {
    userInfoBox.style.display = "none";
    logoutBtn.style.display = "none";
    setSyncStatus("ローカルのみ");
  }
  refreshTimetable();
  render();
}

export function showAuth() {
  state.user = null;
  state.isOffline = false;
  authScreen.style.display = "flex";
  mainApp.classList.remove("visible");
  userInfoBox.style.display = "none";
  logoutBtn.style.display = "none";
  unsubscribeRealtime();
  cells.clear(); // ← timetableの内部stateをクリアするため
  refreshTimetable();
}

export async function initAuth() {
  if (!supabaseClient) {
    state.isOffline = true;
    showApp(null);
    return;
  }

  let initialized = false;
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (!initialized) return;
    if (session) {
      showApp(session.user);
      try {
        await loadRemoteEvents();
        subscribeRealtime(() => loadRemoteEvents());
        render();
      } catch {}
    } else {
      showAuth();
    }
  });

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  initialized = true;
  if (session) {
    showApp(session.user);
    try {
      await loadRemoteEvents();
      subscribeRealtime(() => loadRemoteEvents());
      render();
    } catch {}
  }
}

// ── 認証 UI イベント ──────────────────────────────────────────
authToggleBtn.addEventListener("click", () => {
  state.isAuthMode = state.isAuthMode === "login" ? "signup" : "login";
  const isSignup = state.isAuthMode === "signup";
  authSubmit.textContent = isSignup ? "新規登録" : "ログイン";
  authToggleText.textContent = isSignup
    ? "すでにアカウントをお持ちの場合"
    : "アカウントをお持ちでない場合";
  authToggleBtn.textContent = isSignup ? "ログイン" : "新規登録";
  authError.style.display = "none";
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.style.display = "none";
  authSubmit.disabled = true;
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  try {
    if (state.isAuthMode === "signup") {
      const { error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;
      authError.textContent =
        "確認メールを送信しました。メールを確認してからログインしてください。";
      authError.style.display = "block";
      authForm.reset();
    } else {
      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    }
  } catch (err) {
    authError.textContent = err.message;
    authError.style.display = "block";
  } finally {
    authSubmit.disabled = false;
    authSubmit.textContent =
      state.isAuthMode === "login" ? "ログイン" : "新規登録";
  }
});

logoutBtn.addEventListener("click", async () => {
  if (!confirm("ログアウトしますか？")) return;
  await supabaseClient.auth.signOut();
});

offlineBtn.addEventListener("click", () => {
  state.isOffline = true;
  showApp(null);
});
