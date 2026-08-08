const STORAGE_KEY = "playingNextNotificationPrefs";

export type NotificationPreferences = {
  sound: boolean;
  browser: boolean;
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  sound: true,
  browser: false,
};

/*
 * Preferences live in localStorage rather than the database — whether
 * you want a sound or an OS notification is a property of the device
 * you're standing behind the decks with, not your DJ account, and
 * Notification permission itself is already scoped per-browser.
 */
export function getNotificationPreferences(): NotificationPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_PREFERENCES;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return DEFAULT_PREFERENCES;
    }

    return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function setNotificationPreferences(
  preferences: NotificationPreferences
) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

export function isBrowserNotificationSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isBrowserNotificationSupported()) return false;

  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  const result = await Notification.requestPermission();
  return result === "granted";
}

export function showBrowserNotification(title: string, body: string) {
  if (!isBrowserNotificationSupported()) return;
  if (Notification.permission !== "granted") return;

  new Notification(title, {
    body,
    icon: "/logo.svg",
  });
}

/*
 * A short two-tone chime synthesised with the Web Audio API rather than
 * an audio file — no asset to ship, and it's a couple of lines either
 * way.
 */
export function playNotificationSound() {
  if (typeof window === "undefined") return;

  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const now = context.currentTime;

  [880, 1320].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    const start = now + index * 0.12;
    const end = start + 0.14;

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, end);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(start);
    oscillator.stop(end);
  });

  setTimeout(() => context.close(), 500);
}

export function triggerVibration() {
  if (typeof window === "undefined") return;
  if (!("vibrate" in navigator)) return;

  navigator.vibrate([120, 60, 120]);
}
