"use client";

import { Music2, Mic, Crown, Check } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { VIP_PRICE, VIP_SLOT_LIMIT } from "@/src/lib/pricing";
import { cn } from "@/src/lib/cn";

export const MESSAGE_MAX_LENGTH = 500;

type RequestType = "song_request" | "song_message";

type Props = {
  requestType: RequestType;
  setRequestType: (value: RequestType) => void;
  requestPrice: number;
  shoutoutPrice: number;
  message: string;
  setMessage: (value: string) => void;
  isTakingRequests: boolean;
  isVip: boolean;
  setIsVip: (value: boolean) => void;
  vipAvailable: boolean;
};

const money = (pence: number) => `£${(pence / 100).toFixed(2)}`;

/*
 * Request type and VIP are two different questions, and they used to
 * look like the same one.
 *
 * All three were rendered as identical bordered cards, so "Song Request
 * vs Song + Message" (pick exactly one) sat beside "VIP Priority" (an
 * optional extra on whichever you picked) with nothing to distinguish
 * them. A guest could reasonably read it as three prices to choose
 * between — and a screen reader got three plain buttons whose only
 * indication of state was the word "Selected" or "Added" buried in the
 * label.
 *
 * Now the two request types are a real radiogroup, and VIP is a switch
 * sitting visually underneath the choice it modifies, so the shape of
 * the control matches the shape of the decision.
 */
export default function RequestOptions({
  requestType,
  setRequestType,
  requestPrice,
  shoutoutPrice,
  message,
  setMessage,
  isTakingRequests,
  isVip,
  setIsVip,
  vipAvailable,
}: Props) {
  const shouldReduceMotion = useReducedMotion();

  const types: {
    value: RequestType;
    icon: typeof Music2;
    label: string;
    detail: string;
    price: number;
  }[] = [
    {
      value: "song_request",
      icon: Music2,
      label: "Song request",
      detail: "Ask the DJ to play a track.",
      price: requestPrice,
    },
    {
      value: "song_message",
      icon: Mic,
      label: "Song + message",
      detail: "Add a shoutout with your song.",
      price: shoutoutPrice,
    },
  ];

  /* Arrow keys move between radios, which is what a radiogroup owes a
     keyboard user; roving tabindex keeps the group one tab stop. */
  const onTypeKeyDown = (event: React.KeyboardEvent) => {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
    if (!keys.includes(event.key) || !isTakingRequests) return;

    event.preventDefault();
    const next = requestType === "song_request" ? "song_message" : "song_request";
    setRequestType(next);
  };

  const vipDisabled = !isTakingRequests || (!isVip && !vipAvailable);
  const remaining = message.length;

  return (
    <div>
      <h2 className="text-base font-bold tracking-tight sm:text-lg">
        Your request
      </h2>

      <div
        role="radiogroup"
        aria-label="Request type"
        onKeyDown={onTypeKeyDown}
        className="mt-3 grid gap-2 sm:grid-cols-2"
      >
        {types.map((type) => {
          const selected = requestType === type.value;

          return (
            <button
              key={type.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              disabled={!isTakingRequests}
              onClick={() => setRequestType(type.value)}
              className={cn(
                "flex min-h-[68px] items-start gap-2.5 rounded-card border p-3 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised",
                "disabled:cursor-not-allowed disabled:opacity-40",
                selected
                  ? "border-accent/50 bg-accent/[0.08]"
                  : "border-white/10 bg-surface-base/60 hover:border-white/20"
              )}
            >
              {/*
                A tick, not the word "Selected". Selection was previously
                carried by border colour plus a text label that read as
                part of the option's own description.
              */}
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                  selected
                    ? "border-accent bg-accent text-black"
                    : "border-white/25"
                )}
              >
                {selected && <Check size={11} strokeWidth={3.5} />}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <type.icon
                    size={14}
                    aria-hidden
                    className={selected ? "text-accent" : "text-zinc-500"}
                  />
                  <span className="text-sm font-semibold text-white">
                    {type.label}
                  </span>
                </span>

                <span className="mt-1 block text-xs leading-4 text-zinc-500">
                  {type.detail}
                </span>
              </span>

              <span className="shrink-0 text-sm font-bold tabular-nums text-white">
                {money(type.price)}
              </span>
            </button>
          );
        })}
      </div>

      {/*
        The message field belongs to the Song + message option, so it
        appears under the group rather than as a peer of it, and only
        when that option is chosen.
      */}
      {requestType === "song_message" && (
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
          }
          className="mt-3"
        >
          <div className="flex items-baseline justify-between gap-3">
            <label
              htmlFor="shoutout-message"
              className="text-xs font-semibold text-zinc-300"
            >
              Your shoutout
            </label>

            {/*
              The server has always cut this at 500 characters with
              .slice(), so anything longer was silently thrown away after
              the guest had written it. maxLength stops it happening and
              the counter means nobody reaches the limit by surprise.
            */}
            <span
              className={cn(
                "text-[11px] tabular-nums",
                remaining > MESSAGE_MAX_LENGTH - 25
                  ? "text-status-pending"
                  : "text-zinc-600"
              )}
            >
              {remaining}/{MESSAGE_MAX_LENGTH}
            </span>
          </div>

          <textarea
            id="shoutout-message"
            disabled={!isTakingRequests}
            value={message}
            /*
             * Clamped here as well as by maxLength. maxLength only
             * constrains what a person types or pastes; it does nothing
             * for a value that arrives another way, and the server ends
             * the story with .slice(0, 500) either way. Capping the
             * state itself is what actually guarantees the guest never
             * loses text they believed they had written.
             */
            onChange={(event) =>
              setMessage(event.target.value.slice(0, MESSAGE_MAX_LENGTH))
            }
            maxLength={MESSAGE_MAX_LENGTH}
            rows={3}
            placeholder="Happy birthday Sarah!"
            aria-describedby="shoutout-hint"
            className="mt-1.5 w-full rounded-control border border-white/10 bg-surface-base px-3.5 py-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-accent/50 focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-40"
          />

          <p id="shoutout-hint" className="mt-1.5 text-[11px] text-zinc-600">
            The DJ sees this with your request. Keep it friendly.
          </p>
        </motion.div>
      )}

      {/*
        VIP: an add-on to the choice above, not a third option in it.
        A switch, indented under the group, with its price written as a
        "+" so it reads as an addition rather than a replacement price.
      */}
      <div className="mt-3">
        <button
          type="button"
          role="switch"
          aria-checked={isVip}
          disabled={vipDisabled}
          onClick={() => setIsVip(!isVip)}
          className={cn(
            "flex w-full items-center gap-3 rounded-card border p-3 text-left transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised",
            "disabled:cursor-not-allowed disabled:opacity-50",
            isVip
              ? "border-amber-400/40 bg-amber-400/[0.07]"
              : "border-white/10 bg-surface-base/60 hover:border-white/20"
          )}
        >
          <Crown
            size={16}
            aria-hidden
            className={cn("shrink-0", isVip ? "text-amber-300" : "text-zinc-500")}
          />

          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-sm font-semibold text-white">
                Skip the queue
              </span>
              <span className="text-sm font-bold tabular-nums text-amber-300">
                +{money(VIP_PRICE)}
              </span>
            </span>

            {/*
              What VIP actually does, and what it does not. It moves the
              request above every non-VIP one in the DJ's queue; it has
              never made the DJ more likely to accept it, and saying so
              would be selling something the product does not do.
            */}
            <span className="mt-0.5 block text-xs leading-4 text-zinc-500">
              {!vipAvailable && !isVip
                ? `All ${VIP_SLOT_LIMIT} priority slots are taken right now. You can still send a normal request.`
                : "If the DJ accepts, your song goes above every standard request in their queue."}
            </span>
          </span>

          {/* A real switch track. Colour alone never carries the state:
              the track position, the tick and aria-checked all do. */}
          <span
            aria-hidden
            className={cn(
              "relative h-6 w-10 shrink-0 rounded-full transition-colors",
              isVip ? "bg-amber-400" : "bg-white/15"
            )}
          >
            <motion.span
              layout={!shouldReduceMotion}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 500, damping: 34 }
              }
              className={cn(
                "absolute top-1 h-4 w-4 rounded-full bg-white shadow",
                isVip ? "left-5" : "left-1"
              )}
            />
          </span>
        </button>
      </div>
    </div>
  );
}
