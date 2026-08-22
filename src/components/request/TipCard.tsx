"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Heart, ChevronDown } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Button from "@/src/components/ui/Button";
import { SERVICE_FEE } from "@/src/lib/pricing";
import { TIP_PRESETS_PENCE, isValidTipAmount } from "@/src/lib/tips";
import { cn } from "@/src/lib/cn";

type Props = {
  djSlug: string;
  isTakingRequests: boolean;
};

const money = (pence: number) => `£${(pence / 100).toFixed(2)}`;

const TIP_MESSAGE_MAX = 200;

/*
 * Tipping, kept deliberately quiet and deliberately separate.
 *
 * A tip is its own row in `tips` with no request_id — the schema cannot
 * link one to a song request, so nothing here may suggest it does. It
 * does not affect the queue, it does not make a DJ more likely to accept
 * anything, and it is not part of the request total. It sits below the
 * request flow, collapsed, as an optional gesture someone can choose to
 * make; there is no nagging, no guilt, and no "your DJ works hard"
 * framing.
 *
 * The fee line is new and it matters: /api/tips/checkout has always
 * added SERVICE_FEE as a second Stripe line item, but this card showed
 * only the tip amount, so the button read "Send £5.00 Tip" while the
 * card was charged £5.50. Stripe's own page disclosed it before payment,
 * so nothing was hidden at the point of sale — but our button was
 * telling the guest the wrong number, and that is not something a
 * payment button gets to do.
 */
export default function TipCard({ djSlug, isTakingRequests }: Props) {
  const shouldReduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(
    TIP_PRESETS_PENCE[1]
  );
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const customPence = customAmount
    ? Math.round(parseFloat(customAmount) * 100)
    : null;

  const amountPence = customPence ?? selectedPreset;
  const validAmount = Boolean(amountPence && isValidTipAmount(amountPence));
  const total = amountPence ? amountPence + SERVICE_FEE : null;

  const sendTip = async () => {
    if (!amountPence || !isValidTipAmount(amountPence) || submitting) {
      toast.error("Please choose a tip amount between £1 and £100.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/tips/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          djSlug,
          amount: amountPence,
          message: message.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Something went wrong starting checkout.");
      }

      window.location.href = data.url;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to start checkout."
      );
      setSubmitting(false);
    }
  };

  if (!isTakingRequests) return null;

  return (
    <section
      aria-label="Tip the DJ"
      className="overflow-hidden rounded-card border border-white/5 bg-surface-raised/60"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="tip-panel"
        className="flex min-h-[60px] w-full items-center gap-3 px-3.5 text-left transition-colors hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60 sm:px-5"
      >
        <Heart size={16} aria-hidden className="shrink-0 text-pink-400/80" />

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-zinc-200">
            Tip the DJ
          </span>
          <span className="mt-0.5 block text-xs text-zinc-500">
            Optional, and separate from any song request.
          </span>
        </span>

        <ChevronDown
          size={16}
          aria-hidden
          className={cn(
            "shrink-0 text-zinc-500 transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <motion.div
          id="tip-panel"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16 }}
          className="border-t border-white/5 p-3.5 sm:p-5"
        >
          <div
            role="radiogroup"
            aria-label="Tip amount"
            className="flex flex-wrap gap-2"
          >
            {TIP_PRESETS_PENCE.map((preset) => {
              const selected = selectedPreset === preset && !customAmount;

              return (
                <button
                  key={preset}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => {
                    setSelectedPreset(preset);
                    setCustomAmount("");
                  }}
                  className={cn(
                    "min-h-11 rounded-full px-5 text-sm font-semibold transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised",
                    selected
                      ? "bg-accent-strong text-black"
                      : "border border-white/10 bg-white/5 text-zinc-200 hover:border-white/20"
                  )}
                >
                  £{(preset / 100).toFixed(0)}
                </button>
              );
            })}

            <label htmlFor="tip-custom" className="sr-only">
              Custom tip amount in pounds
            </label>
            <input
              id="tip-custom"
              type="number"
              inputMode="decimal"
              min="1"
              max="100"
              step="0.5"
              placeholder="Other £"
              value={customAmount}
              onChange={(event) => {
                setCustomAmount(event.target.value);
                setSelectedPreset(null);
              }}
              className="h-11 w-28 rounded-full border border-white/10 bg-surface-base px-4 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
            />
          </div>

          <div className="mt-3">
            <div className="flex items-baseline justify-between gap-3">
              <label
                htmlFor="tip-message"
                className="text-xs font-semibold text-zinc-300"
              >
                Message <span className="font-normal text-zinc-600">(optional)</span>
              </label>
              <span className="text-[11px] tabular-nums text-zinc-600">
                {message.length}/{TIP_MESSAGE_MAX}
              </span>
            </div>

            <textarea
              id="tip-message"
              value={message}
              onChange={(event) =>
                setMessage(event.target.value.slice(0, TIP_MESSAGE_MAX))
              }
              maxLength={TIP_MESSAGE_MAX}
              rows={2}
              placeholder="Great set!"
              className="mt-1.5 w-full rounded-control border border-white/10 bg-surface-base px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
            />
          </div>

          {/* The same fee the song-request summary shows, for the same
              reason: the guest should recognise the number on the button
              when they reach Stripe. */}
          {validAmount && total && (
            <dl className="mt-3 space-y-1.5 border-t border-white/5 pt-3 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Tip</dt>
                <dd className="tabular-nums text-zinc-300">
                  {money(amountPence!)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Service fee</dt>
                <dd className="tabular-nums text-zinc-300">
                  {money(SERVICE_FEE)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 font-semibold">
                <dt className="text-zinc-300">Total</dt>
                <dd className="tabular-nums text-white">{money(total)}</dd>
              </div>
            </dl>
          )}

          <Button
            onClick={sendTip}
            disabled={submitting || !validAmount}
            aria-busy={submitting}
            className="mt-3.5 w-full"
          >
            {submitting
              ? "Opening payment..."
              : validAmount && total
                ? `Tip ${money(total)}`
                : "Choose an amount"}
          </Button>
        </motion.div>
      )}
    </section>
  );
}
