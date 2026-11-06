import { ref } from "vue";
export type Theme = "light" | "dark";
const key = "paper-between-theme";
export const theme = ref<Theme>("light");
let media: MediaQueryList | undefined;
let manual = false,
  initialized = false;
export function applyTheme(value: Theme, persist = true) {
  theme.value = value;
  document.documentElement.dataset.theme = value;
  document.documentElement.style.colorScheme = value;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", value === "dark" ? "#211e1b" : "#ece5db");
  if (persist) {
    manual = true;
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Still usable without browser storage. */
    }
  }
}
export function initializeTheme() {
  if (initialized) return;
  initialized = true;
  media = matchMedia("(prefers-color-scheme: dark)");
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(key);
  } catch {}
  manual = saved === "light" || saved === "dark";
  applyTheme(
    manual ? (saved as Theme) : media.matches ? "dark" : "light",
    false,
  );
  media.addEventListener("change", (event) => {
    if (!manual) applyTheme(event.matches ? "dark" : "light", false);
  });
}
export function toggleTheme() {
  applyTheme(theme.value === "light" ? "dark" : "light");
}
export function restoreTheme(value: unknown) {
  if (value === "light" || value === "dark") applyTheme(value);
}
