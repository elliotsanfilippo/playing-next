/*
 * The guest's ownership record.
 *
 * Guests have no account, so "my requests" is defined entirely by a list
 * of request ids kept in localStorage per DJ slug, which is then posted
 * to /api/my-requests. That endpoint returns an explicit field list with
 * no payment intent and no financial data, so holding an id gets you the
 * status of that one request and nothing else.
 *
 * Every read goes through here because they were not all guarded. The
 * list page parsed localStorage with a bare JSON.parse, so a single
 * malformed entry — a half-written value, a quota error mid-write, a
 * browser extension touching storage — threw during render and took the
 * page down entirely, with no way for the guest to recover short of
 * clearing site data. Storage is shared, mutable, and outside our
 * control; it has to be treated as untrusted input.
 */

const keyFor = (djSlug: string) => `myRequestIds_${djSlug}`;

/** Ids look like uuids. Anything else in storage is not ours. */
const isPlausibleId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 64;

export function readGuestRequestIds(djSlug: string): string[] {
  if (typeof window === "undefined") return [];

  let raw: string | null = null;

  try {
    raw = window.localStorage.getItem(keyFor(djSlug));
  } catch {
    /* Storage can throw outright — Safari private mode, disabled
       cookies, exceeded quota. An unreadable store is an empty one. */
    return [];
  }

  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    /* Filter rather than reject: one bad entry should not lose the
       guest every other request they made tonight. */
    return parsed.filter(isPlausibleId);
  } catch {
    return [];
  }
}

export function addGuestRequestId(djSlug: string, requestId: string) {
  if (typeof window === "undefined") return;

  const existing = readGuestRequestIds(djSlug).filter((id) => id !== requestId);

  try {
    window.localStorage.setItem(
      keyFor(djSlug),
      JSON.stringify([requestId, ...existing])
    );
    notify();
  } catch (error) {
    /* Losing the record means the guest cannot track this request, but
       the request itself is already created and paid for, so failing
       loudly here would be worse than carrying on. */
    console.log("Could not store request id:", error);
  }
}

export function clearGuestRequestIds(djSlug: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(keyFor(djSlug));
    notify();
  } catch (error) {
    console.log("Could not clear request ids:", error);
  }
}


/*
 * ── Reading the store from React ────────────────────────────────────
 *
 * localStorage is an external store, so React should read it through
 * useSyncExternalStore rather than copying it into state from a mount
 * effect — that version wrote state synchronously on mount, which is a
 * cascading render.
 *
 * useSyncExternalStore compares snapshots by identity, and
 * readGuestRequestIds builds a fresh array every call, so the parsed
 * result is memoised against the raw string it came from. Without that
 * cache the component re-renders forever.
 */
const snapshotCache = new Map<string, { raw: string; ids: string[] }>();

const EMPTY: string[] = [];

const listeners = new Set<() => void>();

function rawFor(djSlug: string): string {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(keyFor(djSlug)) ?? "";
  } catch {
    return "";
  }
}

export function subscribeGuestRequestIds(onChange: () => void) {
  listeners.add(onChange);

  /* Another tab writing the same key fires "storage" here, so a request
     made in one tab shows up in the list open in another. */
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onChange);
  }

  return () => {
    listeners.delete(onChange);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onChange);
    }
  };
}

export function getGuestRequestIdsSnapshot(djSlug: string): string[] {
  const raw = rawFor(djSlug);
  const cached = snapshotCache.get(djSlug);

  if (cached && cached.raw === raw) return cached.ids;

  const ids = raw ? readGuestRequestIds(djSlug) : EMPTY;
  snapshotCache.set(djSlug, { raw, ids });
  return ids;
}

/** Nothing is stored on the server, so the server snapshot is empty. */
export function getGuestRequestIdsServerSnapshot(): string[] {
  return EMPTY;
}

function notify() {
  listeners.forEach((listener) => listener());
}
