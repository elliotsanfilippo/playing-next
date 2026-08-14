"use client";

import { useState } from "react";
import { PartyPopper, Lock, ChevronDown } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import Button from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import Eyebrow from "@/src/components/ui/Eyebrow";
import { supabase } from "@/src/lib/supabase";

export type DjEvent = {
  id: string;
  name: string;
  request_price: number | null;
  shoutout_price: number | null;
  is_active: boolean;
  created_at: string;
  ended_at: string | null;
  requestCount: number;
  totalEarnings: number;
};

type Props = {
  events: DjEvent[];
  isPro: boolean;
  onChanged: () => void;
};

export default function EventsCard({ events, isPro, onChanged }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [requestPrice, setRequestPrice] = useState("");
  const [shoutoutPrice, setShoutoutPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  /*
   * Free DJs and Pro DJs with nothing running both collapse to a
   * single slim row instead of a full card — this section only
   * deserves real space on the dashboard once there's something
   * actually happening (an active event) or the DJ has chosen to open
   * it up to manage one. No outer Card here: the dashboard nests this
   * inside a shared notifications strip alongside QrBoxBanner.
   */
  if (!isPro) {
    return (
      <Link
        href="/plans"
        className="flex items-start gap-3 px-5 py-3.5 transition hover:bg-white/[0.03] sm:items-center"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/5 text-zinc-400">
          <Lock size={15} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-300">
            <span className="font-semibold text-white">Events Mode</span>
            {" "}&middot; run named events with their own pricing
          </p>
        </div>

        <span className="shrink-0 self-center text-sm font-semibold text-accent">
          Compare plans
        </span>
      </Link>
    );
  }

  const activeEvent = events.find((event) => event.is_active) ?? null;
  const pastEvents = events.filter((event) => !event.is_active).slice(0, 6);

  const withAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  };

  const startEvent = async (eventId: string | null, body?: Record<string, unknown>) => {
    const session = await withAuth();
    if (!session) return false;

    if (body) {
      const createRes = await fetch("/api/dj/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      const createData = await createRes.json();

      if (!createRes.ok) {
        toast.error(createData.error || "Unable to create event.");
        return false;
      }

      eventId = createData.eventId;
    }

    const activateRes = await fetch("/api/dj/events/activate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ eventId }),
    });

    const activateData = await activateRes.json();

    if (!activateRes.ok) {
      toast.error(activateData.error || "Unable to update event.");
      return false;
    }

    return true;
  };

  const handleCreate = async () => {
    if (submitting) return;

    if (!name.trim()) {
      toast.error("Please give this event a name.");
      return;
    }

    setSubmitting(true);

    try {
      const body: Record<string, unknown> = { name: name.trim() };

      if (requestPrice.trim()) {
        const pence = Math.round(parseFloat(requestPrice) * 100);
        if (!Number.isInteger(pence) || pence <= 0) {
          toast.error("Enter a valid song request price.");
          return;
        }
        body.requestPrice = pence;
      }

      if (shoutoutPrice.trim()) {
        const pence = Math.round(parseFloat(shoutoutPrice) * 100);
        if (!Number.isInteger(pence) || pence <= 0) {
          toast.error("Enter a valid song + message price.");
          return;
        }
        body.shoutoutPrice = pence;
      }

      const ok = await startEvent(null, body);

      if (ok) {
        toast.success(`${name.trim()} is now live.`);
        setName("");
        setRequestPrice("");
        setShoutoutPrice("");
        setCreating(false);
        onChanged();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnd = async () => {
    if (pendingActionId) return;
    setPendingActionId("end");

    try {
      const ok = await startEvent(null);
      if (ok) {
        toast.success("Event ended.");
        onChanged();
      }
    } finally {
      setPendingActionId(null);
    }
  };

  const handleRestart = async (eventId: string, eventName: string) => {
    if (pendingActionId) return;
    setPendingActionId(eventId);

    try {
      const ok = await startEvent(eventId);
      if (ok) {
        toast.success(`${eventName} is now live.`);
        onChanged();
      }
    } finally {
      setPendingActionId(null);
    }
  };

  if (!activeEvent && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition hover:bg-white/[0.03] sm:items-center"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <PartyPopper size={15} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-300">
            <span className="font-semibold text-white">Events Mode</span>
            {" "}&middot; No active event
          </p>
        </div>

        <span className="flex shrink-0 items-center gap-1 self-center text-sm font-semibold text-accent">
          Manage <ChevronDown size={15} />
        </span>
      </button>
    );
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <PartyPopper size={20} />
          </div>

          <div>
            <Eyebrow tone="accent">Events Mode</Eyebrow>

            <h2 className="mt-1 text-xl font-bold">
              {activeEvent ? activeEvent.name : "No active event"}
            </h2>

            <p className="mt-2 text-sm text-zinc-400">
              {activeEvent
                ? "New requests and tips are being tracked under this event."
                : "Running as your regular ongoing session."}
            </p>
          </div>
        </div>

        {activeEvent ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={pendingActionId === "end"}
            onClick={handleEnd}
            className="shrink-0"
          >
            {pendingActionId === "end" ? "Ending..." : "End Event"}
          </Button>
        ) : (
          <div className="flex shrink-0 gap-2">
            {!creating && (
              <Button
                size="sm"
                onClick={() => setCreating(true)}
                className="shrink-0"
              >
                + Start New Event
              </Button>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setExpanded(false)}
              className="shrink-0"
            >
              Collapse
            </Button>
          </div>
        )}
      </div>

        {creating && (
          <div className="mt-5 rounded-control border border-white/10 bg-white/[0.03] p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                placeholder="Event name (e.g. Smith Wedding)"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={submitting}
                className="sm:col-span-3"
              />

              <Input
                placeholder="Song price £ (optional)"
                value={requestPrice}
                onChange={(event) => setRequestPrice(event.target.value)}
                disabled={submitting}
              />

              <Input
                placeholder="Song + message £ (optional)"
                value={shoutoutPrice}
                onChange={(event) => setShoutoutPrice(event.target.value)}
                disabled={submitting}
                className="sm:col-span-2"
              />
            </div>

            <p className="mt-2 text-xs text-zinc-500">
              Leave prices blank to use your normal pricing for this event.
            </p>

            <div className="mt-4 flex gap-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={submitting}
                onClick={() => setCreating(false)}
              >
                Cancel
              </Button>

              <Button size="sm" disabled={submitting} onClick={handleCreate}>
                {submitting ? "Starting..." : "Start Event"}
              </Button>
            </div>
          </div>
        )}

        {pastEvents.length > 0 && (
          <div className="mt-6 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Past events
            </p>

            {pastEvents.map((event) => (
              <div
                key={event.id}
                className="flex flex-col gap-2 rounded-control border border-white/10 bg-white/[0.02] p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">
                    {event.name}
                  </p>

                  <p className="mt-0.5 text-sm text-zinc-500">
                    {event.requestCount} request
                    {event.requestCount === 1 ? "" : "s"} &middot; £
                    {(event.totalEarnings / 100).toFixed(2)} earned
                  </p>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pendingActionId === event.id}
                  onClick={() => handleRestart(event.id, event.name)}
                  className="shrink-0"
                >
                  {pendingActionId === event.id ? "Starting..." : "Restart"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
  );
}
