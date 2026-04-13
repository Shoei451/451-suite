import { db } from "./supabase_config.js";

function getHomePath() {
  const depth = location.pathname.split("/").filter(Boolean).length;
  const prefix = depth > 1 ? "../".repeat(depth - 1) : "./";
  return prefix + "home.html";
}

export function redirectToHome() {
  location.replace(getHomePath());
}

const {
  data: { session },
} = await db.auth.getSession();

if (!session) {
  redirectToHome();
}

db.auth.onAuthStateChange((_event, latestSession) => {
  if (!latestSession) {
    redirectToHome();
  }
});

export const user = session?.user ?? null;

export async function signOutAndRedirect(
  confirmMessage = "ログアウトしますか？",
) {
  if (confirmMessage && !confirm(confirmMessage)) {
    return false;
  }
  await db.auth.signOut();
  redirectToHome();
  return true;
}

export function wireLogoutButton(
  buttonId = "logout-btn",
  confirmMessage = "ログアウトしますか？",
) {
  document.getElementById(buttonId)?.addEventListener("click", () => {
    void signOutAndRedirect(confirmMessage);
  });
}
