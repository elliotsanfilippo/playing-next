"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, Lock, PartyPopper, Pencil } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import Button from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import MoneyValue from "@/src/components/product/MoneyValue";
import { supabase } from "@/src/lib/supabase";
import { LIMITS, poundsToPence, penceToPounds } from "@/src/lib/settingsValidation";
import { isEventStale } from "@/src/lib/activeEvent";
import type { EventFieldErrors } from "@/src/lib/eventValidation";

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
  /** The events query failed. Not the same as having no events. */
  loadFailed: boolean;
  onChanged: () => void;
};

/** null means inherit, and the DJ is told so rather than left guessing
 *  what an empty box does. Lowercase because it reads inside a
 *  sentence: "Song request uses your default". */
const overrideLabel = (pence: number | null) =>
  pence === null ? "uses your default" : `£${penceToPounds(pence)}`;

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

export default function EventsCard({
  events,
  isPro,
  loadFailed,
  onChanged,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [formFor, setFormFor] = useState<"new" | string | null>(null);
  const [name, setName] = useState("");
  const [requestPrice, setRequestPrice] = useState("");
  const [messagePrice, setMessagePrice] = useState("");
  const [errors, setErrors] = useState<EventFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  /*
   * Unknown before anything else.
   *
   * A failed events load used to leave the list empty and isPro false,
   * so a Pro DJ with a live event was shown the Free upsell row while
   * that event was still setting the prices their guests were paying.
   */
  if (loadFailed) {
    return (
      <div className="flex items-start gap-3 px-5 py-3.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/5 text-zinc-300">
          <AlertTriangle size={15} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Events Mode</p>
          <p className="mt-0.5 text-xs text-zinc-400">
            Couldn&apos;t check whether an event is running. Your requests and
            queue are unaffected.
          </p>
        </div>

        <Button
          variant="secondary"
          className="h-11 shrink-0 self-center px-3 text-xs"
          onClick={onChanged}
        >
          Retry
        </Button>
      </div>
    );
  }

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
          <p className="text-sm font-semibold text-white">Events Mode</p>
          <p className="mt-0.5 text-xs text-zinc-400">
            Named events with their own pricing
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

  const token = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const openForm = (target: "new" | DjEvent, prefill?: DjEvent) => {
    const source = target === "new" ? prefill : target;

    setFormFor(target === "new" ? "new" : target.id);
    setName(source?.name ?? "");
    setRequestPrice(
      source?.request_price != null ? penceToPounds(source.request_price) : ""
    );
    setMessagePrice(
      source?.shoutout_price != null ? penceToPounds(source.shoutout_price) : ""
    );
    setErrors({});
  };

  const closeForm = () => {
    setFormFor(null);
    setErrors({});
  };

  /** Blank stays blank: null is a real value here meaning "use my
   *  default", so an empty box is never coerced to a number. */
  const priceField = (value: string): number | null | "invalid" => {
    if (!value.trim()) return null;
    const pence = poundsToPence(value);
    return pence === null ? "invalid" : pence;
  };

  const buildBody = () => {
    const request = priceField(requestPrice);
    const message = priceField(messagePrice);
    const next: EventFieldErrors = {};

    if (request === "invalid") next.requestPrice = "Enter an amount like 5 or 7.50.";
    if (message === "invalid") next.messagePrice = "Enter an amount like 8 or 9.50.";

    if (Object.keys(next).length) {
      setErrors(next);
      return null;
    }

    return { name, requestPrice: request, messagePrice: message };
  };

  const handleSave = async () => {
    if (submitting) return;

    const body = buildBody();
    if (!body) return;

    setSubmitting(true);
    setErrors({});

    try {
      const accessToken = await token();
      if (!accessToken) return;

      const editing = formFor !== "new";

      const response = await fetch("/api/dj/events", {
        method: editing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(editing ? { ...body, eventId: formFor } : body),
      });

      const data = await response.json();

      if (!response.ok) {
        /* Field errors land under their field. The server is the
           authority, so its messages are the ones shown. */
        if (data.errors) setErrors(data.errors as EventFieldErrors);
        else toast.error(data.error || "Unable to save this event.");
        return;
      }

      if (editing) {
        toast.success("Event updated.");
        closeForm();
        onChanged();
        return;
      }

      const activateResponse = await fetch("/api/dj/events/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ eventId: data.eventId }),
      });

      const activateData = await activateResponse.json();

      if (!activateResponse.ok) {
        toast.error(activateData.error || "Unable to start this event.");
        onChanged();
        return;
      }

      toast.success(`${body.name} is now live.`);
      closeForm();
      onChanged();
    } finally {
      setSubmitting(false);
    }
  };

  const runActivate = async (eventId: string | null, key: string) => {
    if (pendingActionId) return;
    setPendingActionId(key);

    try {
      const accessToken = await token();
      if (!accessToken) return;

      const response = await fetch("/api/dj/events/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ eventId }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Unable to update event.");
        onChanged();
        return;
      }

      toast.success(eventId ? "Event started." : "Event ended.");
      onChanged();
    } finally {
      setPendingActionId(null);
    }
  };

  /*
   * Running a past event again starts a new one, prefilled from it.
   *
   * It used to flip the old row back to active and clear its ended_at,
   * so two separate nights merged into one record with one request count
   * and one earnings total, and no way to pull them apart afterwards.
   * One row per gig is the only version of this that can support event
   * reporting later.
   */
  const runAgain = (event: DjEvent) => {
    setExpanded(true);
    openForm("new", event);
  };

  if (!activeEvent && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex min-h-[54px] w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-white/[0.03]"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <PartyPopper size={15} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Events Mode</p>
          <p className="mt-0.5 text-xs text-zinc-400">No event running</p>
        </div>

        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-accent">
          Manage <ChevronDown size={15} />
        </span>
      </button>
    );
  }

  const form = (
    <div className="mt-4 rounded-control border border-white/10 bg-surface-base/60 p-3.5">
      <div className="space-y-3.5">
        <div>
          <label
            htmlFor="event-name"
            className="text-[13px] font-semibold text-zinc-200"
          >
            Event name
          </label>
          <Input
            id="event-name"
            value={name}
            maxLength={LIMITS.eventName.max}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "event-name-error" : undefined}
            onChange={(event) => setName(event.target.value)}
            className="mt-1.5"
          />
          {errors.name && (
            <p id="event-name-error" className="mt-1.5 text-xs text-status-declined">
              {errors.name}
            </p>
          )}
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          {(
            [
              ["event-request-price", "Song request", requestPrice, setRequestPrice, errors.requestPrice],
              ["event-message-price", "Song + Message", messagePrice, setMessagePrice, errors.messagePrice],
            ] as const
          ).map(([id, label, value, setValue, error]) => (
            <div key={id}>
              <label htmlFor={id} className="text-[13px] font-semibold text-zinc-200">
                {label}
              </label>

              <div className="relative mt-1.5">
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
                >
                  £
                </span>
                <Input
                  id={id}
                  inputMode="decimal"
                  value={value}
                  placeholder="Your default"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${id}-error` : `${id}-hint`}
                  onChange={(event) => setValue(event.target.value)}
                  className="pl-8"
                />
              </div>

              {error ? (
                <p id={`${id}-error`} className="mt-1.5 text-xs text-status-declined">
                  {error}
                </p>
              ) : (
                <p id={`${id}-hint`} className="mt-1.5 text-xs text-zinc-400">
                  Leave blank to use your default.
                </p>
              )}
            </div>
          ))}
        </div>

        {/* What a guest actually pays, on the same basis as checkout. */}
        {poundsToPence(requestPrice) !== null && (
          <p className="text-xs leading-5 text-zinc-400">
            A guest pays{" "}
            <MoneyValue
              pence={poundsToPence(requestPrice)! + 50}
              compact={false}
              className="font-semibold text-zinc-200"
            />{" "}
            for a standard request at this event, including our 50p service
            fee.
          </p>
        )}

        <div className="flex flex-wrap gap-2.5">
          <Button
            className="h-11 px-4 text-[13px]"
            onClick={handleSave}
            disabled={submitting}
          >
            {submitting
              ? "Saving..."
              : formFor === "new"
                ? "Start event"
                : "Save changes"}
          </Button>

          <Button
            variant="secondary"
            className="h-11 px-4 text-[13px]"
            onClick={closeForm}
            disabled={submitting}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="px-5 py-4 sm:px-6">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <PartyPopper size={15} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
            Events Mode
          </p>

          <h2 className="mt-0.5 text-base font-bold">
            {activeEvent ? activeEvent.name : "No event running"}
          </h2>

          <p className="mt-1 text-xs leading-5 text-zinc-400">
            {activeEvent
              ? "Requests and tips are being tracked under this event."
              : "Running on your normal prices."}
          </p>

          {/* One sentence when nothing is overridden, rather than saying
              "uses your default" twice about the same thing. */}
          {activeEvent && (
            <p className="mt-1.5 text-xs text-zinc-400">
              {activeEvent.request_price === null &&
              activeEvent.shoutout_price === null
                ? "Charging your normal prices."
                : `Song request ${overrideLabel(activeEvent.request_price)} · Song + Message ${overrideLabel(activeEvent.shoutout_price)}`}
            </p>
          )}

          {/*
            An event left running long past its night keeps setting
            prices, and would quietly pick up again if a lapsed
            subscription were renewed months later. Rather than expiring
            it on a timer — which would change prices underneath a DJ
            mid-set, and a Friday night running into Saturday morning is
            ordinary — it is simply said out loud, with the two actions
            already to hand above.
          */}
          {activeEvent && isEventStale(activeEvent) && (
            <p className="mt-1.5 text-xs leading-5 text-status-pending">
              This started on {dayLabel(activeEvent.created_at)} and is still
              running. End it if that gig is over.
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {activeEvent ? (
            <>
              <Button
                variant="secondary"
                className="h-11 px-3 text-xs"
                onClick={() => openForm(activeEvent)}
              >
                <Pencil size={13} aria-hidden className="mr-1.5" />
                Edit
              </Button>

              {/* Secondary, not primary: ending is the one action here a
                  DJ cannot walk back into the same row. */}
              <Button
                variant="secondary"
                className="h-11 px-3 text-xs"
                disabled={pendingActionId === "end"}
                onClick={() => runActivate(null, "end")}
              >
                {pendingActionId === "end" ? "Ending..." : "End event"}
              </Button>
            </>
          ) : (
            <>
              {formFor === null && (
                <Button
                  className="h-11 px-3 text-xs"
                  onClick={() => openForm("new")}
                >
                  Start event
                </Button>
              )}

              <Button
                variant="secondary"
                className="h-11 px-3 text-xs"
                onClick={() => setExpanded(false)}
              >
                Collapse
              </Button>
            </>
          )}
        </div>
      </div>

      {formFor !== null && form}

      {pastEvents.length > 0 && formFor === null && (
        <div className="mt-4 border-t border-white/5 pt-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
            Past events
          </p>

          <ul className="mt-2 space-y-1.5">
            {pastEvents.map((event) => (
              <li
                key={event.id}
                className="flex items-center gap-3 rounded-control border border-white/5 bg-surface-base/60 p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-white">
                    {event.name}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {event.ended_at ? dayLabel(event.ended_at) : dayLabel(event.created_at)}
                    {" · "}
                    {event.requestCount} request
                    {event.requestCount === 1 ? "" : "s"}
                    {" · "}
                    <MoneyValue pence={event.totalEarnings} className="text-zinc-300" />
                  </p>
                </div>

                <Button
                  variant="secondary"
                  className="h-11 shrink-0 px-3 text-xs"
                  onClick={() => runAgain(event)}
                >
                  Run again
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
