"use client";

import type {
  SongRequest,
  DJProfile,
} from "@/src/types/dashboard";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { supabase } from "../../../src/lib/supabase";
import DashboardHeader from "./components/DashboardHeader";
import StatsCards from "./components/StatsCards";
import PlayingNextCard from "./components/PlayingNextCard";
import PendingRequests from "./components/PendingRequests";
import AcceptedQueue from "./components/AcceptedQueue";
import SetupChecklist from "./components/SetupChecklist";
import QRCard from "./components/QRCard";
import HistoryCard from "./components/HistoryCard";
import Onboarding from "./components/Onboarding";
import LaunchComplete from "./components/LaunchComplete";
import { toast } from "sonner";


export default function DJDashboardPage() {
  const router = useRouter();

  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [djProfile, setDjProfile] = useState<DJProfile | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const fetchDJProfile = async () => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
  setLoadingDashboard(false);
  alert(userError.message);
  return;
}

  if (!user) {
  setLoadingDashboard(false);
  alert("No logged-in user found.");
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

  setRequests(data || []);
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

const reorderQueue = async () => {
  if (!djProfile) return;

  const { data, error } = await supabase
    .from("song_requests")
    .select("id")
    .eq("dj_profile_id", djProfile.id)
    .eq("request_status", "accepted")
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

  const updateRequestStatus = async (
  requestId: string,
  status: string
) => {
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
toast.success("History cleared");
  const clearPlayedHistory = async () => {
  if (!djProfile) {
    toast.error("DJ profile not loaded yet.");
    return;
  }

  const { data, error } = await supabase
    .from("song_requests")
    .update({ dj_hidden: true })
    .eq("dj_profile_id", djProfile.id)
    .in("request_status", ["played", "declined"])
    .select();

  if (error) {
    console.log("Clear history error:", error);
    toast.error(error.message);
    return;
  }

  await fetchRequests();
};
toast.success("Request accepted");
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
  accessToken: (await supabase.auth.getSession()).data.session?.access_token,
}),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.message || result.error);
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
  accessToken: (await supabase.auth.getSession()).data.session?.access_token,
}),
    });

    if (!response.ok) {
      const result = await response.json();
      console.log("Stripe cancel error:", result);
    }
  }

  await updateRequestStatus(request.id, "declined");
};
toast.success("Request declined");
const moveAcceptedRequest = async (
  requestId: string,
  direction: "up" | "down" | "top"
) => {
  const sortedAccepted = [...acceptedRequests].sort(
  (a: any, b: any) =>
    (a.queue_position || 999) - (b.queue_position || 999)
);

  const currentIndex = sortedAccepted.findIndex(
    (request) => request.id === requestId
  );

  if (currentIndex === -1) return;

  const newOrder = [...sortedAccepted];
  const [selectedRequest] = newOrder.splice(currentIndex, 1);

  if (direction === "top") {
    newOrder.unshift(selectedRequest);
  }

  if (direction === "up") {
    const targetIndex = Math.max(currentIndex - 1, 0);
    newOrder.splice(targetIndex, 0, selectedRequest);
  }

  if (direction === "down") {
    const targetIndex = Math.min(currentIndex + 1, newOrder.length);
    newOrder.splice(targetIndex, 0, selectedRequest);
  }

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
  .sort(
    (a: any, b: any) =>
      (a.queue_position || 999) - (b.queue_position || 999)
  );

  const playingNextRequests = requests.filter(
    (request) => request.request_status === "playing_next"
  );

  const playedRequests = requests.filter(
    (request) => request.request_status === "played"
  );

  const currentPlayingNext = playingNextRequests[0];
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

  const { error } = await supabase
    .from("dj_profiles")
    .update({
      onboarding_complete: true,
    })
    .eq("id", djProfile.id);

  if (error) {
    toast.error(error.message);
    return;
  }

  await fetchDJProfile();
};
if (loadingDashboard) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
      <p>Loading dashboard...</p>
    </main>
  );
}
if (
  djProfile &&
  !djProfile.onboarding_complete &&
  !onboardingComplete
) {
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
if (
  djProfile &&
  onboardingComplete &&
  !djProfile.launch_complete_seen
) {
  return (
    <LaunchComplete
      qrCodeUrl={qrCodeUrl}
      requestLink={requestLink}
      onContinue={continueFromLaunch}
    />
  );
}
  return (
  <main className="min-h-screen bg-zinc-950 p-5 text-white sm:p-6">
    <div className="mx-auto max-w-6xl">
      <DashboardHeader
  djProfile={djProfile}
  isTakingRequests={isTakingRequests}
  toggleRequests={toggleRequests}
  logout={logout}
  router={router}
/>

      <StatsCards
  pendingCount={pendingRequests.length}
  queueCount={acceptedRequests.length}
  playedCount={playedRequests.length}
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

      <SetupChecklist
  djProfile={djProfile}
  qrCodeUrl={qrCodeUrl}
/>

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