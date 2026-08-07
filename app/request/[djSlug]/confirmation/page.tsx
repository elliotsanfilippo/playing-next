"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "../../../../src/lib/supabase";

type SubmittedRequest = {
  id: string;
  song_title: string;
  artist: string;
  request_type: string | null;
  message: string | null;
  request_status: string;
  queue_position: number | null;
};

export default function ConfirmationPage() {
  const params = useParams();
  const djSlug = params.djSlug as string;

  const searchParams = useSearchParams();
  const requestId = searchParams.get("requestId");

  const [request, setRequest] = useState<SubmittedRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const fetchRequest = useCallback(async () => {
  setLoading(true);
  setLoadError("");

  if (!requestId) {
    setLoadError("We could not find this request.");
    setLoading(false);
    return;
  }

    const { data, error } = await supabase
      .from("song_requests")
      .select(
        "id, song_title, artist, request_type, message, request_status, queue_position"
      )
      .eq("id", requestId)
      .single();

    if (error || !data) {
      console.log("Confirmation request load error:", error);
      setLoadError("We could not load your request.");
      setLoading(false);
      return;
    }

    setRequest(data);
    setLoadError("");
    setLoading(false);
  }, [requestId]);

  useEffect(() => {
    fetchRequest();

    if (!requestId) return;

    const channel = supabase
      .channel(`confirmation_${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "song_requests",
          filter: `id=eq.${requestId}`,
        },
        () => fetchRequest()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRequest, requestId]);

  const status = request?.request_status || "pending";

  const statusDetails = {
    checkout_pending: {
      label: "Confirming Payment",
      description: "Your payment is being confirmed.",
      classes:
        "border-amber-500/20 bg-amber-500/10 text-amber-300",
      dot: "bg-amber-400",
    },
    pending: {
      label: "Pending Approval",
      description: "The DJ is reviewing your request.",
      classes:
        "border-amber-500/20 bg-amber-500/10 text-amber-300",
      dot: "bg-amber-400",
    },
    accepted: {
      label: "Request Accepted",
      description: "Your request has been added to the DJ’s queue.",
      classes:
        "border-green-500/20 bg-green-500/10 text-green-300",
      dot: "bg-green-400",
    },
    playing_next: {
      label: "Playing Next",
      description: "Get ready — your request is coming up.",
      classes:
        "border-blue-500/20 bg-blue-500/10 text-blue-300",
      dot: "bg-blue-400",
    },
    played: {
      label: "Played",
      description: "Your request has been played.",
      classes:
        "border-white/10 bg-white/5 text-zinc-200",
      dot: "bg-zinc-300",
    },
    declined: {
      label: "Request Declined",
      description:
        "The DJ could not accept this request. Your payment will not be captured.",
      classes:
        "border-red-500/20 bg-red-500/10 text-red-300",
      dot: "bg-red-400",
    },
  }[status] || {
    label: "Pending Approval",
    description: "The DJ is reviewing your request.",
    classes:
      "border-amber-500/20 bg-amber-500/10 text-amber-300",
    dot: "bg-amber-400",
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070809] p-5 text-white">
        <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-zinc-900/70 p-8 text-center">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-white/10" />

          <h1 className="mt-5 text-2xl font-bold">
            Loading your request...
          </h1>
        </div>
      </main>
    );
  }

  if (loadError || !request) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070809] p-5 text-white">
        <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-zinc-900/70 p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-3xl">
            !
          </div>

          <h1 className="mt-5 text-3xl font-bold">
            Request not found
          </h1>

          <p className="mt-3 text-zinc-400">
            {loadError}
          </p>

          <Link
            href={`/request/${djSlug}`}
            className="mt-7 inline-flex rounded-2xl bg-white px-6 py-3 font-semibold text-black"
          >
            Return to request page
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070809] px-5 py-10 text-white sm:px-6 sm:py-14">
      <section className="mx-auto max-w-2xl">
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-green-500/20 bg-green-500/10 text-4xl shadow-xl shadow-green-500/10">
            ✓
          </div>

          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.22em] text-green-400">
            Request submitted
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            You&apos;re in.
          </h1>

          <p className="mx-auto mt-4 max-w-md leading-7 text-zinc-400">
            Your payment has been authorised and your request has been
            sent to the DJ.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 shadow-2xl shadow-black/30">
          <div className="p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              {request.request_type === "song_message"
                ? "Song + Message"
                : "Song Request"}
            </p>

            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              {request.song_title}
            </h2>

            <p className="mt-2 text-lg text-zinc-400">
              {request.artist}
            </p>

            {request.request_type === "song_message" &&
              request.message && (
                <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Your message
                  </p>

                  <p className="mt-3 leading-7 text-zinc-200">
                    “{request.message}”
                  </p>
                </div>
              )}
          </div>

          <div className="border-t border-white/5 p-6 sm:p-8">
            <div
              className={`rounded-3xl border p-5 ${statusDetails.classes}`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${statusDetails.dot}`}
                />

                <div>
                  <h3 className="text-lg font-bold">
                    {statusDetails.label}
                  </h3>

                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {statusDetails.description}
                  </p>
                </div>
              </div>
            </div>

            {status === "accepted" &&
  request.queue_position && (
                <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div>
                    <p className="text-sm text-zinc-500">
                      Queue position
                    </p>

                    <p className="mt-1 text-sm text-zinc-400">
                      Your place in the accepted queue
                    </p>
                  </div>

                  <p className="text-3xl font-bold">
                    #{request.queue_position}
                  </p>
                </div>
              )}

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-5">
              <p className="font-semibold">
                Updates happen automatically
              </p>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
  {status === "pending" || status === "checkout_pending"
    ? "No need to refresh. You’ll only be charged if the DJ accepts your request."
    : status === "declined"
      ? "No need to refresh. Your payment will not be captured."
      : "No need to refresh. Your request status will update here automatically."}
</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href={`/request/${djSlug}/my-requests`}
            className="flex min-h-[56px] items-center justify-center rounded-2xl bg-white px-6 font-bold text-black transition hover:bg-zinc-200"
          >
            View My Requests
          </Link>

          <Link
            href={`/request/${djSlug}`}
            className="flex min-h-[56px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 font-semibold transition hover:bg-white/10"
          >
            Request Another Song
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Secure payment powered by Stripe
        </p>
      </section>
    </main>
  );
}