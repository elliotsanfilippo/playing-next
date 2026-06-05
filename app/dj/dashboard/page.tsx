"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { supabase } from "../../../src/lib/supabase";

type SongRequest = {
  id: string;
  song_title: string;
  artist: string;
  message: string | null;
  request_type: string | null;
  request_status: string;
  stripe_payment_intent_id: string | null;
  queue_position: number | null;
};

type DJProfile = {
  id: string;
  dj_name: string;
  slug: string;
  request_status: string;
  profile_image_url: string | null;
};


export default function DJDashboardPage() {
  const router = useRouter();

  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [djProfile, setDjProfile] = useState<DJProfile | null>(null);

  const fetchDJProfile = async () => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    alert(userError.message);
    return;
  }

  if (!user) {
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
    console.log("DJ profile load error:", error);
    alert(error.message);
    return;
  }

  setDjProfile(data);
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
    alert("DJ profile not loaded yet.");
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
    alert(error.message);
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
    alert(error.message);
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
    alert("DJ profile not loaded yet.");
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
    alert(error.message);
    return;
  }

  await fetchRequests();
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
      }),
    });

    if (!response.ok) {
      const result = await response.json();
      console.log("Stripe cancel error:", result);
    }
  }

  await updateRequestStatus(request.id, "declined");
};
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
      alert(error.message);
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
  
  return (
    <main className="min-h-screen bg-zinc-950 p-5 text-white sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
  {djProfile?.profile_image_url ? (
    <img
      src={djProfile.profile_image_url}
      alt={djProfile.dj_name}
      className="h-16 w-16 rounded-full object-cover"
    />
  ) : (
    <div className="h-16 w-16 rounded-full bg-zinc-800" />
  )}

  <div>
    <p className="text-sm text-zinc-400">Playing Next</p>

    <h1 className="mt-2 text-4xl font-bold">
      {djProfile?.dj_name || "DJ Dashboard"}
    </h1>
  </div>
</div>

          <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
  <button
    onClick={toggleRequests}
    className={`h-12 rounded-full px-6 text-sm font-semibold transition ${
      isTakingRequests
        ? "bg-green-500/20 text-green-400"
        : "bg-red-500/20 text-red-400"
    }`}
  >
    {isTakingRequests ? "Taking Requests" : "Requests Paused"}
  </button>

  <button
    onClick={() => router.push("/dj/analytics")}
    className="h-12 rounded-full border border-white/10 bg-zinc-900 px-6 text-sm font-semibold text-white transition hover:bg-zinc-800"
  >
    Analytics
  </button>

  <button
    onClick={() => router.push("/dj/settings")}
    className="h-12 rounded-full border border-white/10 bg-zinc-900 px-6 text-sm font-semibold text-white transition hover:bg-zinc-800"
  >
    Settings
  </button>

  <button
    onClick={logout}
    className="h-12 rounded-full border border-red-500/20 bg-red-500/10 px-6 text-sm font-semibold text-red-400 transition hover:bg-red-500/20"
  >
    Log Out
  </button>
</div>
        </div>

        <div className="mb-6 rounded-3xl border border-white/10 bg-zinc-900 p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div>
              <h2 className="text-2xl font-semibold">
                Share Your Request Link
              </h2>

              <p className="mt-2 text-sm text-zinc-400">
                Guests can scan this code to request songs.
              </p>
            </div>

            {qrCodeUrl && (
              <img
                src={qrCodeUrl}
                alt="DJ Request QR Code"
                className="w-56 rounded-2xl bg-white p-4"
              />
            )}

            <div className="rounded-full bg-zinc-950 px-4 py-2 text-sm text-zinc-400">
              {displayRequestLink}
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <button
                onClick={() => navigator.clipboard.writeText(requestLink)}
                className="w-full rounded-full bg-white px-4 py-3 text-center text-sm font-semibold text-black sm:w-auto"
              >
                Copy Link
              </button>

              <a
                href={qrCodeUrl}
                download="playing-next-qr-code.png"
                className="w-full rounded-full border border-white/10 px-4 py-3 text-center text-sm font-semibold text-white sm:w-auto"
              >
                Download QR
              </a>
            </div>
          </div>
        </div>

        {currentPlayingNext && (
          <div className="mb-6 rounded-3xl border border-white/10 bg-white p-6 text-black">
            <p className="text-sm font-semibold text-zinc-500">Playing Next</p>

            <h2 className="mt-2 text-4xl font-bold">
              {currentPlayingNext.song_title}
            </h2>

            <p className="mt-1 text-zinc-600">{currentPlayingNext.artist}</p>
{currentPlayingNext.request_type === "song_message" && (
  <div className="mt-4 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
      Shoutout Message
    </p>

    <p className="mt-1 text-sm">
      {currentPlayingNext.message}
    </p>
  </div>
)}
            <button
              onClick={() =>
                updateRequestStatus(currentPlayingNext.id, "played")
              }
              className="mt-6 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white"
            >
              Mark as Played
            </button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-zinc-900 p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Pending Requests</h2>

              <div className="rounded-full bg-yellow-500/20 px-4 py-2 text-sm text-yellow-400">
                {pendingRequests.length}
              </div>
            </div>

            <div className="space-y-4">
              {pendingRequests.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-zinc-950 p-6 text-center">
                  <p className="font-semibold text-zinc-300">
                    Waiting for requests...
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">
                    Share your QR code with the crowd.
                  </p>
                </div>
              ) : (
                pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-2xl border border-white/10 bg-zinc-950 p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-semibold">{request.song_title}</h3>

                        <p className="text-sm text-zinc-400">
                          {request.artist}
                        </p>
{request.request_type === "song_message" && (
  <div className="mt-3 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-purple-300">
      Shoutout Message
    </p>

    <p className="mt-1 text-sm text-white">
      {request.message || "No message provided"}
    </p>
  </div>
)}
                        <p className="mt-2 text-xs text-zinc-500">
                          {request.stripe_payment_intent_id
                            ? "Payment authorised"
                            : "No payment attached"}
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => declineRequest(request)}
                          className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold"
                        >
                          Decline
                        </button>

                        <button
                          onClick={() => acceptRequest(request)}
                          className="rounded-full bg-green-500 px-4 py-2 text-sm font-semibold text-black"
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-900 p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Accepted Queue</h2>

              <div className="rounded-full bg-green-500/20 px-4 py-2 text-sm text-green-400">
                {acceptedRequests.length}
              </div>
            </div>

            <div className="space-y-4">
              {acceptedRequests.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-zinc-950 p-6 text-center">
                  <p className="font-semibold text-zinc-300">
                    No accepted requests yet.
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">
                    Accepted songs will appear here.
                  </p>
                </div>
              ) : (
                acceptedRequests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-2xl border border-white/10 bg-zinc-950 p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-semibold">{request.song_title}</h3>

                        <p className="text-sm text-zinc-400">
                          {request.artist}
                        </p>
                        {request.request_type === "song_message" && (
  <div className="mt-3 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-purple-300">
      Shoutout Message
    </p>

    <p className="mt-1 text-sm text-white">
      {request.message || "No message provided"}
    </p>
  </div>
)}
<div className="mt-4 flex gap-2">
  <button
    onClick={() =>
      moveAcceptedRequest(request.id, "top")
    }
    className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold"
  >
    ⬆ Top
  </button>

  <button
    onClick={() =>
      moveAcceptedRequest(request.id, "up")
    }
    className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold"
  >
    ↑ Up
  </button>

  <button
    onClick={() =>
      moveAcceptedRequest(request.id, "down")
    }
    className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold"
  >
    ↓ Down
  </button>
</div>
                      </div>

                      {currentPlayingNext ? (
                        <button
                          disabled
                          className="cursor-not-allowed rounded-full bg-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-400"
                        >
                          Waiting
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            updateRequestStatus(request.id, "playing_next")
                          }
                          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
                        >
                          Playing Next
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-zinc-900 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">
                Played History ({playedRequests.length})
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Songs already marked as played.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white"
              >
                {showHistory ? "Hide History" : "Show History"}
              </button>

              {playedRequests.length > 0 && (
                <button
                  onClick={clearPlayedHistory}
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
                >
                  Clear History
                </button>
              )}
            </div>
          </div>

          {showHistory && (
            <div className="mt-6 space-y-3">
              {playedRequests.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-zinc-950 p-6 text-center text-zinc-400">
                  No played requests yet.
                </div>
              ) : (
                playedRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-950 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <h3 className="font-semibold">{request.song_title}</h3>
                      <p className="text-sm text-zinc-400">
                        {request.artist}
                      </p>
                    </div>

                    <div className="rounded-full bg-white/10 px-4 py-2 text-sm text-zinc-300">
                      Played
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}