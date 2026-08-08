export type WidgetSize = "compact" | "normal" | "large";

export type DashboardWidgetKey =
  | "stats"
  | "pendingRequests"
  | "queue"
  | "qr"
  | "history";

export type DashboardLayoutPrefs = Record<DashboardWidgetKey, WidgetSize>;

const STORAGE_KEY = "playingNextDashboardLayout";

const DEFAULT_PREFS: DashboardLayoutPrefs = {
  stats: "normal",
  pendingRequests: "normal",
  queue: "normal",
  qr: "normal",
  history: "normal",
};

/*
 * Widget sizing lives in localStorage, not the database — like the
 * notification prefs, it's a property of the screen the DJ is currently
 * looking at, not their account.
 */
export function getDashboardLayoutPrefs(): DashboardLayoutPrefs {
  if (typeof window === "undefined") {
    return DEFAULT_PREFS;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return DEFAULT_PREFS;
    }

    return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function setDashboardLayoutPrefs(prefs: DashboardLayoutPrefs) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
