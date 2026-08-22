"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GuestRequest = {
  id: string;
  song_title: string;
  artist: string;
  request_type: string | null;
  message: string | null;
  request_status: string;
  queue_position: number | null;
  is_vip: boolean;
  decline_reason: string | null;
  reported_not_played_at: string | null;
};

/** Cadence is unchanged from before; only the failure handling is new. */
const POLL_MS = 4000;

/*
 * How many polls in a row must fail before the guest is told.
 *
 * One failure used to replace the entire page with an error screen: any
 * blip on venue wifi and the guest lost sight of a request they had just
 * paid for. The last good status is far more useful than an error, so a
 * failure now keeps what we know and only surfaces after three
 * consecutive misses — about twelve seconds, long enough that a single
 * dropped request is invisible and a real outage still gets reported.
 */
const FAILURES_BEFORE_WARNING = 3;

type State = {
  request: GuestRequest | null;
  /** True only until the first response, never again. */
  loading: boolean;
  /** Set only when the very first load fails; a later failure keeps the
   *  last good request instead. */
  fatalError: string;
  /** Sustained polling trouble, with a known status still on screen. */
  stale: boolean;
};

export function useRequestStatus(requestIds: string[] | null) {
  const [state, setState] = useState<State>({
    request: null,
    loading: true,
    fatalError: "",
    stale: false,
  });

  const failuresRef = useRef(0);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  const key = requestIds ? requestIds.join(",") : "";

  const poll = useCallback(async () => {
    if (!key) return;

    /* One request at a time. On a slow connection the interval could
       otherwise stack polls on top of each other. */
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/my-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestIds: key.split(",") }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(String(response.status));

      const result = await response.json();
      const data: GuestRequest | undefined = result.requests?.[0];

      if (!mountedRef.current) return;

      if (!data) {
        /* A genuine "no such request" is not a network blip, so it is
           only fatal when we have never had anything to show. */
        setState((current) =>
          current.request
            ? { ...current, stale: false }
            : {
                request: null,
                loading: false,
                fatalError: "We couldn't find this request.",
                stale: false,
              }
        );
        failuresRef.current = 0;
        return;
      }

      failuresRef.current = 0;
      setState({
        request: data,
        loading: false,
        fatalError: "",
        stale: false,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (!mountedRef.current) return;

      failuresRef.current += 1;

      setState((current) => {
        /* Never had a status: this is the load failing, and there is
           nothing to keep. */
        if (!current.request) {
          return {
            ...current,
            loading: false,
            fatalError: "We couldn't load your request.",
          };
        }

        /* Had a status: keep showing it. */
        return {
          ...current,
          stale: failuresRef.current >= FAILURES_BEFORE_WARNING,
        };
      });
    } finally {
      inFlightRef.current = false;
    }
  }, [key]);

  useEffect(() => {
    mountedRef.current = true;
    failuresRef.current = 0;

    /* No ids to look up is a known answer, not something to fetch, so it
       is derived below rather than written into state from here. */
    if (!key) return;

    /*
     * eslint-disable-next-line react-hooks/set-state-in-effect --
     * poll() is async and every setState inside it happens after
     * `await fetch`, in the response handler. That is the "subscribe to
     * an external system and setState in a callback" shape the rule
     * exists to allow; it simply cannot see through the await to tell
     * this apart from a synchronous write. Verified: there is no
     * setState before the first await in poll().
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    poll();
    const interval = setInterval(poll, POLL_MS);

    /*
     * Coming back to the tab is the moment a guest most wants the truth,
     * and a phone may have suspended timers while it was away.
     */
    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      abortRef.current?.abort();
    };
  }, [key, poll]);

  /*
   * Derived, not stored. Writing this in the effect was a synchronous
   * setState on mount for every guest arriving without a request id.
   */
  if (!key) {
    return {
      request: null,
      loading: false,
      fatalError: "We couldn't find this request.",
      stale: false,
      refresh: poll,
    };
  }

  return { ...state, refresh: poll };
}
