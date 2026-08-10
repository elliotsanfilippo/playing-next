"use client";

import type {
  SongRequest,
  DJProfile,
} from "@/src/types/dashboard";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { toast } from "sonner";
import { supabase } from "../../../src/lib/supabase";
import {
  getNotificationPreferences,
  playNotificationSound,
  showBrowserNotification,
  triggerVibration,
} from "../../../src/lib/notifications";
import DashboardHeader from "./components/DashboardHeader";
import StatsCards from "./components/StatsCards";
import PlayingNextCard from "./components/PlayingNextCard";
import PendingRequests from "./components/PendingRequests";
import AcceptedQueue from "./components/AcceptedQueue";
import SetupChecklist from "./components/SetupChecklist";
import QrBoxBanner from "./components/QrBoxBanner";
import QRCard from "./components/QRCard";
import HistoryCard from "./components/HistoryCard";
import Onboarding from "./components/Onboarding";
import LaunchComplete from "./components/LaunchComplete";
import DashboardSkeleton from "./components/DashboardSkeleton";

export default function DJDashboardPage() {
  const router = useRouter();

  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [djProfile, setDjProfile] = useState<DJProfile | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

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

    setDjProfile(data);
    setLoadingDashboard(false);
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
        description: `${request.song_title} — ${request.artist}`,
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
          ? `${newRequests[0].song_title} — ${newRequests[0].artist}`
          : newRequests.map((request) => request.song_title).join(", ");

      showBrowserNotification(title, body);
    }
  };

  const toggleRequests = async () => {
    if (!djProfile) {
      toast.error("DJ profile not loaded yet.");
      return;
    }

    const nextStatus =
      djProfile.request_status === "taking_requests"
        ? "paused"
        : "taking_requests";

    const { error } = await supabase
      .from("dj_profiles")
      .update({ request_status: nextStatus })
      .eq("id", djProfile.id);

    if (error) {
      console.log("Toggle requests error:", error);
      toast.error(error.message);
      return;
    }

    setDjProfile({
      ...djProfile,
      request_status: nextStatus,
    });

    await fetchDJProfile();
    await fetchRequests();
  };

  /*
   * VIP-accepted requests always sort ahead of non-VIP ones (FIFO
   * within each tier, by acceptance time) — a hard guarantee that a
   * guest who paid for VIP priority actually gets it, not something
   * the DJ's manual reorder controls can undo.
   */
  const reorderQueue = async () => {
    if (!djProfile) return;

    const { data, error } = await supabase
      .from("song_requests")
      .select("id")
      .eq("dj_profile_id", djProfile.id)
      .eq("request_status", "accepted")
      .order("is_vip", { ascending: false })
      .order("accepted_at", { ascending: true });

    if (error || !data) {
      console.log("Queue reorder error:", error);
      return;
    }

    for (let index = 0; index < data.length; index++) {
      await supabase
        .from("song_requests")
        .update({
          queue_position: index + 1,
        })
        .eq("id", data[index].id);
    }
  };

  const updateRequestStatus = async (requestId: string, status: string) => {
    const { error } = await supabase
      .from("song_requests")
      .update({
        request_status: status,
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
      .in("request_status", ["played", "declined", "refunded", "disputed"])
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

  const declineRequest = async (request: SongRequest) => {
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
      }
    }

    await updateRequestStatus(request.id, "declined");
    toast.success("Request declined");
  };

  /*
   * Reordering is scoped to the request's own VIP tier — a non-VIP
   * request can be dragged around other non-VIP requests, but never
   * above a VIP one, and vice versa. VIP priority is a promise made to
   * the guest who paid for it, not a suggestion.
   */
  const moveAcceptedRequest = async (
    requestId: string,
    direction: "up" | "down" | "top"
  ) => {
    const sortedAccepted = [...acceptedRequests].sort(
      (a, b) => (a.queue_position || 999) - (b.queue_position || 999)
    );

    const selectedRequest = sortedAccepted.find(
      (request) => request.id === requestId
    );

    if (!selectedRequest) return;

    const tier = sortedAccepted.filter(
      (request) => request.is_vip === selectedRequest.is_vip
    );
    const otherTier = sortedAccepted.filter(
      (request) => request.is_vip !== selectedRequest.is_vip
    );

    const currentIndex = tier.findIndex(
      (request) => request.id === requestId
    );

    const newTier = [...tier];
    const [moved] = newTier.splice(currentIndex, 1);

    if (direction === "top") {
      newTier.unshift(moved);
    }

    if (direction === "up") {
      const targetIndex = Math.max(currentIndex - 1, 0);
      newTier.splice(targetIndex, 0, moved);
    }

    if (direction === "down") {
      const targetIndex = Math.min(currentIndex + 1, newTier.length);
      newTier.splice(targetIndex, 0, moved);
    }

    const newOrder = selectedRequest.is_vip
      ? [...newTier, ...otherTier]
      : [...otherTier, ...newTier];

    await Promise.all(
      newOrder.map((request, index) =>
        supabase
          .from("song_requests")
          .update({
            queue_position: index + 1,
          })
          .eq("id", request.id)
      )
    );

    await fetchRequests();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isTakingRequests = djProfile?.request_status === "taking_requests";

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

      await fetchDJProfile();
      await fetchRequests();
    };

    checkAuth();

    const channel = supabase
      .channel("dashboard_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "song_requests" },
        () => fetchRequests()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dj_profiles" },
        () => fetchDJProfile()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

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

  const onboardingComplete =
    Boolean(djProfile) &&
    djProfile!.dj_name !== "New DJ" &&
    (djProfile!.request_price || 0) > 0 &&
    Boolean(djProfile!.profile_image_url) &&
    Boolean(qrCodeUrl) &&
    Boolean(djProfile!.stripe_connected);

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
        qrCodeUrl={qrCodeUrl}
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

  return (
    <main className="min-h-screen bg-canvas p-5 text-white sm:p-6">
      <div className="mx-auto max-w-6xl">
        <DashboardHeader
          djProfile={djProfile}
          isTakingRequests={isTakingRequests}
          toggleRequests={toggleRequests}
          logout={logout}
          router={router}
        />

        {djProfile?.qr_box_eligible &&
          !djProfile.qr_box_claimed &&
          !djProfile.qr_box_dismissed && (
            <QrBoxBanner onDismissed={fetchDJProfile} />
          )}

        <StatsCards
          pendingCount={pendingRequests.length}
          queueCount={acceptedRequests.length}
          playedCount={playedRequests.length}
          tonightRevenue={tonightRevenue}
        />

        <PlayingNextCard
          currentPlayingNext={currentPlayingNext}
          updateRequestStatus={updateRequestStatus}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <PendingRequests
            pendingRequests={pendingRequests}
            acceptRequest={acceptRequest}
            declineRequest={declineRequest}
          />

          <AcceptedQueue
            acceptedRequests={acceptedRequests}
            currentPlayingNext={currentPlayingNext}
            moveAcceptedRequest={moveAcceptedRequest}
            updateRequestStatus={updateRequestStatus}
          />
        </div>

        {!onboardingComplete && (
          <SetupChecklist djProfile={djProfile} qrCodeUrl={qrCodeUrl} />
        )}

        <QRCard
          showQr={showQr}
          setShowQr={setShowQr}
          qrCodeUrl={qrCodeUrl}
          requestLink={requestLink}
          displayRequestLink={displayRequestLink}
        />

        <HistoryCard
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          playedRequests={playedRequests}
          clearPlayedHistory={clearPlayedHistory}
        />
      </div>
    </main>
  );
}
