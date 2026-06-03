"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../../src/lib/supabase";
import { useParams } from "next/navigation";

type SongRequest = {
  id: string;
  song_title: string;
  artist: string;
  message: string | null;
  request_type: string | null;
  request_status: string;
  queue_position: number | null;
};

export default function MyRequestsPage() {
  const params = useParams();
  const djSlug = params.djSlug as string;

  const [requests, setRequests] = useState<SongRequest[]>([]);
  const clearMyRequests = () => {
  localStorage.removeItem(`myRequestIds_${djSlug}`);
  setRequests([]);
};
  const fetchRequests = async () => {
    const myRequestIds = JSON.parse(
      localStorage.getItem(`myRequestIds_${djSlug}`) || "[]"
    );

    if (myRequestIds.length === 0) {
      setRequests([]);
      return;
    }

    const { data, error } = await supabase
      .from("song_requests")
      .select("*")
      .in("id", myRequestIds)
      .neq("request_status", "archived")
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error);
      return;
    }

    setRequests(data || []);
  };

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel("customer_requests")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "song_requests",
        },
        () => fetchRequests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const statusClasses = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/20 text-yellow-300";
      case "accepted":
        return "bg-green-500/20 text-green-300";
      case "playing_next":
        return "bg-purple-500/20 text-purple-300";
      case "played":
        return "bg-blue-500/20 text-blue-300";
      case "declined":
        return "bg-red-500/20 text-red-300";
      default:
        return "bg-white/10 text-zinc-300";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "accepted":
        return "Accepted";
      case "playing_next":
        return "Playing Next";
      case "played":
        return "Played";
      case "declined":
        return "Declined";
      default:
        return status;
    }
  };
const sortedRequests = [...requests].sort((a, b) => {
  const order: Record<string, number> = {
    playing_next: 1,
    accepted: 2,
    pending: 3,
    played: 4,
    declined: 5,
  };

  const statusOrder =
    (order[a.request_status] || 999) -
    (order[b.request_status] || 999);

  if (statusOrder !== 0) {
    return statusOrder;
  }

  if (a.request_status === "accepted") {
    return (
      (a.queue_position || 999) -
      (b.queue_position || 999)
    );
  }

  return 0;
});
  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <section className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-400">Playing Next</p>
            <h1 className="mt-2 text-4xl font-bold">My Requests</h1>
          </div>

          <div className="flex gap-3">
  <button
    onClick={clearMyRequests}
    className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white"
  >
    Clear My Requests
  </button>

  <Link
    href={`/request/${djSlug}`}
    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
  >
    Request More
  </Link>
</div>
        </div>

        <div className="space-y-4">
          {requests.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6 text-center text-zinc-400">
              No requests from this device yet.
            </div>
          ) : (
            sortedRequests.map((request) => (
              <div
                key={request.id}
                className="rounded-2xl border border-white/10 bg-zinc-900 p-6"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {request.song_title}
                    </h2>

                    <p className="mt-1 text-zinc-400">
                      {request.artist}
                    </p>
{request.request_type === "song_message" && (
  <div className="mt-3 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-purple-300">
      Your Message
    </p>

    <p className="mt-1 text-sm text-white">
      {request.message}
    </p>
  </div>
)}
                    {request.request_status === "accepted" && (
                      <p className="mt-3 text-sm text-zinc-400">
                        Queue Position #{request.queue_position}
                      </p>
                    )}

                    {request.request_status === "playing_next" && (
                      <p className="mt-3 text-sm font-semibold text-purple-300">
                        The DJ is about to play your request.
                      </p>
                    )}

                    {request.request_status === "declined" && (
                      <p className="mt-3 text-sm text-zinc-400">
                        You have not been charged.
                      </p>
                    )}
                  </div>

                  <div
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${statusClasses(
                      request.request_status
                    )}`}
                  >
                    {statusLabel(request.request_status)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}