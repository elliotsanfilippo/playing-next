"use client";

import type {
  SongRequest,
  DJProfile,
} from "@/src/types/dashboard";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../../src/lib/supabase";
import {
  getNotificationPreferences,
  playNotificationSound,
  showBrowserNotification,
  triggerVibration,
} from "../../../src/lib/notifications";
import DashboardHeader from "./components/DashboardHeader";
import TonightStrip from "./components/TonightStrip";
import PlayingNextCard from "./components/PlayingNextCard";
import PendingRequests from "./components/PendingRequests";
import AcceptedQueue from "./components/AcceptedQueue";
import SetupChecklist from "./components/SetupChecklist";
import ChargebackBanner, {
  type ChargebackDispute,
} from "./components/ChargebackBanner";
import NotificationsStrip from "./components/NotificationsStrip";
import { type DjEvent } from "./components/EventsCard";
import QRCard from "./components/QRCard";
import HistoryCard from "./components/HistoryCard";
import Onboarding from "./components/Onboarding";
import LaunchComplete from "./components/LaunchComplete";
import PostGigRecapModal from "./components/PostGigRecapModal";
import DashboardSkeleton from "./components/DashboardSkeleton";

/**
 * How long to wait for more realtime events before refetching. Short
 * enough to still feel live, long enough that one logical change which
 * touches several rows costs one refresh instead of one per row.
 */
const REALTIME_COALESCE_MS = 120;

/**
 * How long realtime has to stay down before the DJ is told. Short drops
 * reconnect on their own and are not worth a message; a sustained one
 * means the queue on screen may be stale, which they do need to know.
 */
const REALTIME_OFFLINE_GRACE_MS = 8_000;

export default function DJDashboardPage() {
  const router = useRouter();

  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [tipsToday, setTipsToday] = useState(0);
  const [chargebacks, setChargebacks] = useState<ChargebackDispute[]>([]);
  const [events, setEvents] = useState<DjEvent[]>([]);
  const [eventsIsPro, setEventsIsPro] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [djProfile, setDjProfile] = useState<DJProfile | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [realtimeDown, setRealtimeDown] = useState(false);

  /*
   * Tracks which pending request IDs we've already notified for. null
   * means "haven't done the first fetch yet" — requests already
   * pending when the dashboard loads shouldn't trigger a notification,
   * only ones that show up afterwards.
   */
  const knownPendingIds = useRef<Set<string> | null>(null);

  const fetchDJProfile = async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      setLoadingDashboard(false);
      toast.error(userError.message);
      return;
    }

    if (!user) {
      setLoadingDashboard(false);
      toast.error("No logged-in user found.");
      return;
    }

    const { data, error } = await supabase
      .from("dj_profiles")
      .select("*")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (error) {
      setLoadingDashboard(false);
      console.log("DJ profile load error:", error);
      toast.error(error.message);
      return;
    }

    if (!data) {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        const response = await fetch("/api/dj/bootstrap-profile", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (response.ok) {
          const { data: healedProfile } = await supabase
            .from("dj_profiles")
            .select("*")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();

          setDjProfile(healedProfile);
          setLoadingDashboard(false);
          return;
        }

        console.log("Bootstrap profile self-heal failed:", await response.json());
      }
    }

    setDjProfile(data);
    setLoadingDashboard(false);
  };

  /*
   * Goes through the authenticated API route rather than a direct
   * client query — tips has RLS enabled with zero policies (deny-all),
   * matching the same "service-role only" pattern already used for
   * money-adjacent reads elsewhere.
   */
  const fetchTips = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    const response = await fetch("/api/dj/tips", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (!response.ok) {
      console.log("Tips load error:", await response.json().catch(() => ({})));
      return;
    }

    const data = await response.json();
    setTipsToday((data.todayTotal ?? 0) / 100);
  };

  /*
   * Same service-role-only pattern as fetchTips — chargeback_disputes
   * has zero RLS policies.
   */
  const fetchChargebacks = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    const response = await fetch("/api/dj/chargebacks", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (!response.ok) {
      console.log(
        "Chargebacks load error:",
        await response.json().catch(() => ({}))
      );
      return;
    }

    const data = await response.json();
    setChargebacks(data.disputes ?? []);
  };

  const fetchEvents = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    const response = await fetch("/api/dj/events", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (!response.ok) {
      console.log(
        "Events load error:",
        await response.json().catch(() => ({}))
      );
      return;
    }

    const data = await response.json();
    setEvents(data.events ?? []);
    setEventsIsPro(Boolean(data.isPro));
  };

  const fetchRequests = async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.log("User load error:", userError);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("dj_profiles")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (profileError || !profile) {
      console.log("DJ profile load error:", profileError);
      setRequests([]);
      return;
    }

    const { data, error } = await supabase
      .from("song_requests")
      .select("*")
      .eq("dj_profile_id", profile.id)
      .neq("dj_hidden", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error);
      return;
    }

    const freshRequests = data || [];
    const currentPendingIds = new Set(
      freshRequests
        .filter((request) => request.request_status === "pending")
        .map((request) => request.id)
    );

    if (knownPendingIds.current === null) {
      knownPendingIds.current = currentPendingIds;
    } else {
      const newlyPending = freshRequests.filter(
        (request) =>
          request.request_status === "pending" &&
          !knownPendingIds.current!.has(request.id)
      );

      if (newlyPending.length > 0) {
        notifyNewRequests(newlyPending);
      }

      knownPendingIds.current = currentPendingIds;
    }

    setRequests(freshRequests);
  };

  const notifyNewRequests = (newRequests: SongRequest[]) => {
    const prefs = getNotificationPreferences();

    newRequests.forEach((request) => {
      const isMessage = request.request_type === "song_message";

      toast(isMessage ? "New Song + Message request" : "New song request", {
        description: `${request.song_title} by ${request.artist}`,
      });
    });

    if (prefs.sound) {
      playNotificationSound();
      triggerVibration();
    }

    if (prefs.browser && document.visibilityState !== "visible") {
      const title =
        newRequests.length === 1
          ? newRequests[0].request_type === "song_message"
            ? "New Song + Message request"
            : "New song request"
          : `${newRequests.length} new requests`;

      const body =
        newRequests.length === 1
          ? `${newRequests[0].song_title} by ${newRequests[0].artist}`
          : newRequests.map((request) => request.song_title).join(", ");

      showBrowserNotification(title, body);
    }
  };

  const toggleRequests = async () => {
    if (!djProfile) {
      toast.error("DJ profile not loaded yet.");
      return;
    }

    const nextStatus = isTakingRequests ? "paused" : "taking_requests";

    /*
     * A manual click always clears any pending auto-close — otherwise
     * resuming after an auto-close (or pausing early) would leave a
     * stale schedule that could immediately re-close things again.
     * Resuming also stamps session_started_at, marking the start of a
     * fresh gig for the post-gig recap; pausing leaves it as-is so the
     * recap can read back the window that just ended.
     */
    const updates: {
      request_status: string;
      auto_close_at: null;
      session_started_at?: string;
    } = { request_status: nextStatus, auto_close_at: null };

    if (nextStatus === "taking_requests") {
      updates.session_started_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("dj_profiles")
      .update(updates)
      .eq("id", djProfile.id);

    if (error) {
      console.log("Toggle requests error:", error);
      toast.error(error.message);
      return;
    }

    setDjProfile({ ...djProfile, ...updates });

    await fetchDJProfile();
    await fetchRequests();
  };

  const dismissRecap = async () => {
    if (!djProfile) return;

    const { error } = await supabase
      .from("dj_profiles")
      .update({ session_started_at: null })
      .eq("id", djProfile.id);

    if (error) {
      console.log("Dismiss recap error:", error);
      return;
    }

    setDjProfile({ ...djProfile, session_started_at: null });
  };

  const setAutoClose = async (minutes: number | null) => {
    if (!djProfile) {
      toast.error("DJ profile not loaded yet.");
      return;
    }

    const autoCloseAt = minutes
      ? new Date(Date.now() + minutes * 60_000).toISOString()
      : null;

    const { error } = await supabase
      .from("dj_profiles")
      .update({ auto_close_at: autoCloseAt })
      .eq("id", djProfile.id);

    if (error) {
      console.log("Auto-close update error:", error);
      toast.error(error.message);
      return;
    }

    setDjProfile({ ...djProfile, auto_close_at: autoCloseAt });
    toast.success(
      autoCloseAt ? "Auto-close scheduled." : "Auto-close cancelled."
    );
  };

  /*
   * Resequencing after an accept, decline or status change.
   *
   * This was a SELECT plus one sequentially awaited UPDATE per queued
   * row — 36 round trips and 1561ms on a 35-row queue, on a path that
   * runs every time a request is accepted or declined. It is now a
   * single transactional call to reorder_dj_queue().
   *
   * The VIP-first rule moved into the function with it. Keeping it in
   * SQL is stricter than keeping it here: a client bug could previously
   * have written a VIP-violating order and nothing at the database
   * level would have refused it.
   *
   * The function also ended a real bug. The old query ordered purely by
   * accepted_at, so a DJ's manual Top/Up/Down was silently discarded the
   * next time anything was accepted. queue_position is now the ordering
   * source of truth, and a newly accepted request joins the end of its
   * own VIP tier instead of resetting the queue.
   */
  const reorderQueue = async () => {
    if (!djProfile) return;

    const { error } = await supabase.rpc("reorder_dj_queue");

    if (error) {
      console.log("Queue reorder error:", error);
    }
  };

  const updateRequestStatus = async (
    requestId: string,
    status: string,
    declineReason?: string | null
  ) => {
    const { error } = await supabase
      .from("song_requests")
      .update({
        request_status: status,
        ...(declineReason !== undefined
          ? { decline_reason: declineReason }
          : {}),
      })
      .eq("id", requestId);

    if (error) {
      console.log("Update request status error:", error);
      toast.error(error.message);
      return;
    }

    if (
      status === "accepted" ||
      status === "playing_next" ||
      status === "played" ||
      status === "declined"
    ) {
      await reorderQueue();
    }

    await fetchRequests();
  };

  const clearPlayedHistory = async () => {
    if (!djProfile) {
      toast.error("DJ profile not loaded yet.");
      return;
    }

    const { data, error } = await supabase
      .from("song_requests")
      .update({ dj_hidden: true })
      .eq("dj_profile_id", djProfile.id)
      .in("request_status", [
        "played",
        "declined",
        "cancelled",
        "expired",
        "refunded",
        "disputed",
      ])
      .select();

    if (error) {
      console.log("Clear history error:", error);
      toast.error(error.message);
      return;
    }

    await fetchRequests();
    toast.success("History cleared");
  };

  const acceptRequest = async (request: SongRequest) => {
    if (request.stripe_payment_intent_id) {
      const response = await fetch("/api/stripe/capture", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentIntentId: request.stripe_payment_intent_id,
          requestId: request.id,
          accessToken: (await supabase.auth.getSession()).data.session
            ?.access_token,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.message || result.error);
        return;
      }
    }

    await supabase
      .from("song_requests")
      .update({
        request_status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    await reorderQueue();
    await fetchRequests();
    toast.success("Request accepted");
  };

  const declineRequest = async (
    request: SongRequest,
    declineReason?: string | null
  ) => {
    if (request.stripe_payment_intent_id) {
      const response = await fetch("/api/stripe/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentIntentId: request.stripe_payment_intent_id,
          requestId: request.id,
          accessToken: (await supabase.auth.getSession()).data.session
            ?.access_token,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        console.log("Stripe cancel error:", result);

        /*
         * A failed cancel most often means this request was already
         * accepted (and captured) elsewhere — by another tab, another
         * device, or a stale queue view — between when this DJ opened
         * the dashboard and when they clicked Decline. Writing
         * "declined" over that anyway would tell the guest "you
         * weren't charged" while their card actually was, and it was
         * genuinely paid to the DJ. Refreshing surfaces the real
         * status instead of guessing.
         */
        toast.error(
          result.error ||
            "This request may have already been accepted. Refreshing…"
        );
        await fetchRequests();
        return;
      }
    }

    await updateRequestStatus(request.id, "declined", declineReason ?? null);
    toast.success("Request declined");
  };

  /*
   * Reordering is scoped to the request's own VIP tier — a non-VIP
   * request can be moved around other non-VIP requests, but never above
   * a VIP one, and vice versa. VIP priority is a promise made to the
   * guest who paid for it, not a suggestion.
   *
   * That scoping, and the ordering maths that went with it, now live
   * inside reorder_dj_queue() rather than being computed here and
   * written back as N UPDATEs. The database decides the order and
   * applies it in one transaction, so two moves arriving together
   * cannot interleave into duplicate positions.
   */
  const moveAcceptedRequest = async (
    requestId: string,
    direction: "up" | "down" | "top"
  ) => {
    const { error } = await supabase.rpc("reorder_dj_queue", {
      p_request_id: requestId,
      p_direction: direction,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    await fetchRequests();
  };

  /*
   * The header's QR button reveals the QR panel and scrolls to it,
   * rather than opening a modal over the queue. QR is a live-set
   * action — a DJ points a guest at it mid-set — so it gets a permanent
   * header slot, but the panel itself is large and belongs in the page.
   */
  const showQrPanel = () => {
    setShowQr(true);

    requestAnimationFrame(() => {
      document
        .getElementById("qr-card")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isDjPro =
    djProfile?.plan === "pro" &&
    djProfile?.stripe_subscription_status === "active";

  const autoClosed = Boolean(
    djProfile?.auto_close_at && new Date(djProfile.auto_close_at) <= new Date()
  );

  const isTakingRequests =
    djProfile?.request_status === "taking_requests" && !autoClosed;

  const sessionRequests = djProfile?.session_started_at
    ? requests.filter(
        (request) =>
          new Date(request.created_at) >=
            new Date(djProfile.session_started_at!) &&
          ["accepted", "playing_next", "played"].includes(
            request.request_status
          )
      )
    : [];

  const showRecap =
    !isTakingRequests &&
    Boolean(djProfile?.session_started_at) &&
    sessionRequests.length > 0;

  /*
   * A session with zero successful requests isn't worth a recap —
   * silently clears the pending marker instead of popping up an empty
   * "0 requests played" modal.
   */
  useEffect(() => {
    if (!djProfile?.session_started_at) return;
    if (isTakingRequests) return;
    if (sessionRequests.length > 0) return;

    dismissRecap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [djProfile?.session_started_at, isTakingRequests, sessionRequests.length]);

  const requestLink = djProfile
    ? `${window.location.origin}/request/${djProfile.slug}`
    : "";

  const displayRequestLink = djProfile
    ? `${window.location.origin}/request/${djProfile.slug}`
    : "";

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      /*
       * Best-effort "the DJ is currently paying attention" signal, used
       * to derive whether guests should see them as taking requests —
       * separate from the DJ's own pause/resume toggle, which stays
       * exactly as they left it. Fire-and-forget: worth doing, not
       * worth blocking the dashboard load over.
       */
      supabase
        .from("dj_profiles")
        .update({ last_active_at: new Date().toISOString() })
        .eq("user_id", session.user.id)
        .then(({ error }) => {
          if (error) {
            console.log("Activity timestamp update failed:", error);
          }
        });

      await fetchDJProfile();
      await fetchRequests();
      await fetchTips();
      await fetchChargebacks();
      await fetchEvents();
    };

    checkAuth();
  }, [router]);

  /*
   * Realtime, scoped to this DJ.
   *
   * The subscription used to live in the auth effect above, listening
   * to every row in song_requests and dj_profiles with no filter — so
   * a request for any DJ on the platform triggered a full refetch on
   * every open dashboard. It also could not be filtered from there,
   * because that effect runs before the profile id is known.
   *
   * It now waits for djProfile.id and filters server-side on it, and
   * the channel is named per profile so a remount cannot end up with
   * two subscriptions sharing one topic.
   *
   * Events are coalesced on a short trailing timer. A single reorder
   * currently issues one UPDATE per queued row, and Postgres emits a
   * change event for each, which previously meant one full refetch per
   * row. 120ms is long enough to collapse a burst into one refresh and
   * short enough that a single arriving request still feels instant.
   * It delays the *reaction* to a change, never the change itself.
   */
  const djProfileId = djProfile?.id;

  const realtimeHandlers = useRef({ fetchRequests, fetchDJProfile });

  useEffect(() => {
    realtimeHandlers.current = { fetchRequests, fetchDJProfile };
  });

  useEffect(() => {
    if (!djProfileId) return;

    let requestsTimer: ReturnType<typeof setTimeout> | undefined;
    let profileTimer: ReturnType<typeof setTimeout> | undefined;
    let offlineTimer: ReturnType<typeof setTimeout> | undefined;

    const channel = supabase
      .channel(`dashboard:${djProfileId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "song_requests",
          filter: `dj_profile_id=eq.${djProfileId}`,
        },
        () => {
          clearTimeout(requestsTimer);
          requestsTimer = setTimeout(
            () => realtimeHandlers.current.fetchRequests(),
            REALTIME_COALESCE_MS
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dj_profiles",
          filter: `id=eq.${djProfileId}`,
        },
        () => {
          clearTimeout(profileTimer);
          profileTimer = setTimeout(
            () => realtimeHandlers.current.fetchDJProfile(),
            REALTIME_COALESCE_MS
          );
        }
      )
      /*
       * The subscription had no status callback at all, so a dropped
       * realtime connection was completely silent: the dashboard simply
       * stopped updating and looked like a quiet night. That is the one
       * failure worth a persistent state, because the DJ cannot tell it
       * apart from nothing happening.
       *
       * Deliberately not a toast per blip. Supabase reconnects on its
       * own, and CHANNEL_ERROR fires on ordinary transient drops, so it
       * is only surfaced after it has stayed down — see the delay
       * below. Recovering clears it silently.
       */
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(offlineTimer);
          setRealtimeDown(false);
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          clearTimeout(offlineTimer);
          offlineTimer = setTimeout(
            () => setRealtimeDown(true),
            REALTIME_OFFLINE_GRACE_MS
          );
        }
      });

    return () => {
      clearTimeout(requestsTimer);
      clearTimeout(profileTimer);
      clearTimeout(offlineTimer);
      supabase.removeChannel(channel);
    };
  }, [djProfileId]);

  useEffect(() => {
    const qrBoxResult = new URLSearchParams(window.location.search).get(
      "qr_box"
    );

    if (!qrBoxResult) return;

    if (qrBoxResult === "claimed") {
      toast.success("Your QR display block is on its way!");
    } else if (qrBoxResult === "error") {
      toast.error("Something went wrong with your QR box order.");
    }

    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  useEffect(() => {
    if (!requestLink) {
      setQrCodeUrl("");
      return;
    }

    QRCode.toDataURL(requestLink)
      .then((url) => {
        setQrCodeUrl(url);
      })
      .catch((error) => {
        console.log("QR code error:", error);
        toast.error(error.message);
      });
  }, [requestLink]);

  const pendingRequests = requests.filter(
    (request) => request.request_status === "pending"
  );

  const acceptedRequests = requests
    .filter((request) => request.request_status === "accepted")
    .sort((a, b) => (a.queue_position || 999) - (b.queue_position || 999));

  const playingNextRequests = requests.filter(
    (request) => request.request_status === "playing_next"
  );

  const playedRequests = requests.filter(
    (request) => request.request_status === "played"
  );

  const currentPlayingNext = playingNextRequests[0];

  const todayString = new Date().toDateString();

  const tonightRevenue =
    requests
      .filter(
        (request) =>
          ["accepted", "playing_next", "played"].includes(
            request.request_status
          ) && new Date(request.created_at).toDateString() === todayString
      )
      .reduce((total, request) => total + (request.dj_earnings ?? 0), 0) /
    100;

  /*
   * Every condition here is a fact about the DJ's saved profile, not
   * about what the browser has finished rendering.
   *
   * The QR step used to test `Boolean(qrCodeUrl)`, which is a data URL
   * produced client-side by QRCode.toDataURL() in an effect further
   * down. That made an onboarding decision depend on an image having
   * finished generating: `loadingDashboard` flips false the moment the
   * profile row arrives, but qrCodeUrl is still "" for at least a
   * render after that, so onboardingComplete was briefly false on every
   * single load. Any DJ whose stored `onboarding_complete` flag hadn't
   * been healed yet therefore got the Onboarding screen instead of
   * their dashboard during that window.
   *
   * There was never a real requirement behind it either: the QR code is
   * derived from the profile slug, which exists from signup, so the
   * step is complete as soon as the DJ has a request link to encode.
   * The image is generated on demand for display, and whether it has
   * rendered yet says nothing about onboarding.
   */
  const onboardingComplete =
    Boolean(djProfile) &&
    djProfile!.dj_name !== "New DJ" &&
    (djProfile!.request_price || 0) > 0 &&
    Boolean(djProfile!.profile_image_url) &&
    Boolean(djProfile!.slug) &&
    Boolean(djProfile!.stripe_connected);

  /*
   * A DJ can become fully qualified (all 5 conditions above) without
   * ever clicking through the Onboarding screen's "Continue to
   * Dashboard" button — e.g. finishing their profile via Settings
   * after already having seen the launch-complete screen once. Nothing
   * else in the app calls the completion route in that path, so
   * djProfile.onboarding_complete can stay stuck false forever even
   * though the DJ is genuinely done. This silently self-heals it the
   * next time their dashboard loads, which also lets QR box
   * eligibility (gated on this flag) catch up.
   */
  const onboardingHealAttempted = useRef(false);

  useEffect(() => {
    if (!djProfile || !onboardingComplete || djProfile.onboarding_complete) {
      return;
    }

    if (onboardingHealAttempted.current) return;
    onboardingHealAttempted.current = true;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const response = await fetch("/api/dj/complete-onboarding", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        await fetchDJProfile();
      } else {
        console.log("Onboarding self-heal failed:", await response.json());
      }
    })();
  }, [djProfile, onboardingComplete]);

  const continueFromLaunch = async () => {
    if (!djProfile) return;

    const { error } = await supabase
      .from("dj_profiles")
      .update({
        launch_complete_seen: true,
      })
      .eq("id", djProfile.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await fetchDJProfile();
  };

  const continueToDashboard = async () => {
    if (!djProfile || !onboardingComplete) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      toast.error("Your session is invalid or has expired.");
      return;
    }

    const response = await fetch("/api/dj/complete-onboarding", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      toast.error(result.error || "Unable to update your profile.");
      return;
    }

    await fetchDJProfile();
  };

  if (loadingDashboard) {
    return <DashboardSkeleton />;
  }

  if (djProfile && !djProfile.onboarding_complete && !onboardingComplete) {
    return (
      <Onboarding
        djProfile={djProfile}
        router={router}
        onboardingComplete={onboardingComplete}
        onContinue={continueToDashboard}
      />
    );
  }

  if (djProfile && onboardingComplete && !djProfile.launch_complete_seen) {
    return (
      <LaunchComplete
        qrCodeUrl={qrCodeUrl}
        requestLink={requestLink}
        onContinue={continueFromLaunch}
      />
    );
  }

  /*
   * Composition order is the DJ's attention order, not the old
   * top-to-bottom accumulation of features.
   *
   * Mobile reads: live bar (sticky) -> tonight -> what needs you ->
   * what's playing next -> the queue -> everything else. Passive
   * notices, QR detail, setup and history all moved below the live
   * content; a chargeback stays at the top because it is time-sensitive
   * and money-related.
   *
   * Desktop splits the same order into two columns so pending and the
   * queue are visible at once, with Playing Next sitting directly above
   * the queue it feeds — the same order the homepage established.
   */
  return (
    <main className="min-h-screen bg-canvas px-5 pb-10 text-white sm:px-6">
      <DashboardHeader
        djProfile={djProfile}
        isTakingRequests={isTakingRequests}
        toggleRequests={toggleRequests}
        isPro={isDjPro}
        setAutoClose={setAutoClose}
        logout={logout}
        onShowQr={showQrPanel}
        router={router}
      />

      {/*
       * ── Dashboard spacing scale ──────────────────────────────────
       *
       * One rhythm, set here, rather than each component carrying its
       * own outer margin. Those had drifted to mb-4, mb-5, mb-6, mb-8
       * and mt-8 across seven surfaces, which is why the gaps between
       * sections looked arbitrary.
       *
       *   peer surfaces      space-y-4  ->  sm:space-y-6   (16 / 24)
       *   two-column gap     gap-4      ->  sm:gap-6       (16 / 24)
       *   rows inside a list space-y-2                     (8)
       *   card padding       p-3/p-4    ->  sm:p-4/p-5
       *
       * Peers share one outer gap so the page reads as a stack of equal
       * surfaces; content grouped inside a surface uses the tighter
       * step so grouping stays legible. Phones get the smaller outer
       * value because screen space is the scarce thing there, desktop
       * the larger one because density is not the problem.
       */}
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
        {showRecap && djProfile && (
          <PostGigRecapModal
            djName={djProfile.dj_name}
            djSlug={djProfile.slug}
            sessionRequests={sessionRequests}
            onDismiss={dismissRecap}
          />
        )}

        <ChargebackBanner
          disputes={chargebacks}
          onResolved={fetchChargebacks}
        />

        {realtimeDown && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-card border border-status-pending-surface/25 bg-status-pending-surface/[0.07] px-4 py-3"
          >
            <WifiOff
              size={15}
              className="mt-0.5 shrink-0 text-status-pending"
              aria-hidden
            />
            <p className="text-xs leading-5 text-zinc-300">
              <span className="font-semibold text-status-pending">
                Live updates are offline.
              </span>{" "}
              New requests may not appear on their own. Reconnecting
              automatically, or refresh to be sure.
            </p>
          </div>
        )}

        <TonightStrip
          pendingCount={pendingRequests.length}
          queueCount={acceptedRequests.length}
          playedCount={playedRequests.length}
          tonightRevenue={tonightRevenue}
          tipsToday={tipsToday}
        />

        {/*
          items-start below lg so the stacked mobile cards size to their
          own content, lg:items-stretch above it so the two halves of
          the live workspace share a top and bottom edge. Neither side
          clips or scrolls to achieve that: the shorter card grows and
          distributes the space internally.
        */}
        <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-2 lg:items-stretch">
          {/* min-w-0: a grid item defaults to min-width:auto, which
              stops it shrinking below its content's minimum. With
              truncating song titles and a two-button action row inside,
              that floor sat above the column width and pushed 20px of
              horizontal overflow onto the page at 375px. */}
          <div id="pending-requests" className="min-w-0 scroll-mt-24">
            <PendingRequests
              pendingRequests={pendingRequests}
              acceptRequest={acceptRequest}
              declineRequest={declineRequest}
              isTakingRequests={isTakingRequests}
              autoClosed={autoClosed}
              pendingCap={djProfile?.max_pending_requests ?? 8}
              queueCount={acceptedRequests.length}
              queueCap={djProfile?.max_queue_requests ?? 8}
            />
          </div>

          {/* flex column rather than space-y so the queue can take the
              remaining height once Playing Next has taken what it
              needs. */}
          <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
            <PlayingNextCard
              currentPlayingNext={currentPlayingNext}
              updateRequestStatus={updateRequestStatus}
              queueCount={acceptedRequests.length}
            />

            <div id="accepted-queue" className="flex min-h-0 flex-1 flex-col scroll-mt-24">
              <AcceptedQueue
                acceptedRequests={acceptedRequests}
                currentPlayingNext={currentPlayingNext}
                moveAcceptedRequest={moveAcceptedRequest}
                updateRequestStatus={updateRequestStatus}
                pendingCount={pendingRequests.length}
              />
            </div>
          </div>
        </div>

        {/* Below the fold of live use: passive notices, setup, sharing
            and history. Same peer rhythm as everything above. */}
        <NotificationsStrip
          events={events}
          eventsIsPro={eventsIsPro}
          onEventsChanged={fetchEvents}
          showQrBox={Boolean(
            djProfile?.qr_box_eligible &&
              !djProfile.qr_box_claimed &&
              !djProfile.qr_box_dismissed
          )}
          onQrBoxDismissed={fetchDJProfile}
        />

        {!onboardingComplete && <SetupChecklist djProfile={djProfile} />}

        <div id="qr-card" className="scroll-mt-24">
          <QRCard
            showQr={showQr}
            setShowQr={setShowQr}
            qrCodeUrl={qrCodeUrl}
            requestLink={requestLink}
            displayRequestLink={displayRequestLink}
            djName={djProfile?.dj_name ?? ""}
            djSlug={djProfile?.slug ?? ""}
          />
        </div>

        <div id="history" className="scroll-mt-24">
          <HistoryCard
            showHistory={showHistory}
            setShowHistory={setShowHistory}
            playedRequests={playedRequests}
            clearPlayedHistory={clearPlayedHistory}
          />
        </div>
      </div>
    </main>
  );
}
