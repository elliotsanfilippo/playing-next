import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const REMEMBER_ME_KEY = "pn-remember-me";

/*
 * Routes the session to localStorage (survives closing the browser) or
 * sessionStorage (cleared when the tab/browser closes), based on the
 * "Remember me" choice made at login. Defaults to localStorage so every
 * flow that never touches the checkbox (signup, magic links, etc.) keeps
 * working exactly as it did before this existed.
 */
const conditionalStorage = {
  getItem: (key: string) => {
    if (typeof window === "undefined") return null;

    const store =
      window.localStorage.getItem(REMEMBER_ME_KEY) === "false"
        ? window.sessionStorage
        : window.localStorage;

    return store.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === "undefined") return;

    const store =
      window.localStorage.getItem(REMEMBER_ME_KEY) === "false"
        ? window.sessionStorage
        : window.localStorage;

    store.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof window === "undefined") return;

    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: conditionalStorage,
  },
});
