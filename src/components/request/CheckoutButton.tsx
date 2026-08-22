"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import Button from "@/src/components/ui/Button";
import { SERVICE_FEE, VIP_PRICE } from "@/src/lib/pricing";

type Props = {
  selectedSong: boolean;
  isTakingRequests: boolean;
  requestType: "song_request" | "song_message";
  requestPrice: number;
  shoutoutPrice: number;
  isVip: boolean;
  submitting: boolean;
  onCheckout: () => void;
  /** Rendered inside the request group, so it drops its own border. */
  flush?: boolean;
};

const money = (pence: number) => `£${(pence / 100).toFixed(2)}`;

/*
 * What the guest pays, and the last thing they see before Stripe.
 *
 * SERVICE_FEE is imported rather than redeclared. It used to be a local
 * `const SERVICE_FEE = 50` while the Stripe route imported the shared
 * one, so the number a guest was shown and the number they were charged
 * were two separate constants that happened to agree — changing the fee
 * in pricing.ts would have silently left this summary lying.
 *
 * The maths deliberately mirrors app/api/stripe/checkout: base price
 * (event override, then DJ price), plus VIP, plus the service fee. The
 * server re-resolves all of it from the database rather than trusting
 * anything sent from here, so this is a faithful preview of that
 * calculation, never an input to it.
 */
export default function CheckoutButton({
  selectedSong,
  isTakingRequests,
  requestType,
  requestPrice,
  shoutoutPrice,
  isVip,
  submitting,
  onCheckout,
  flush = false,
}: Props) {
  const requestAmount =
    requestType === "song_message" ? shoutoutPrice : requestPrice;

  const totalAmount = requestAmount + (isVip ? VIP_PRICE : 0) + SERVICE_FEE;

  const requestLabel =
    requestType === "song_message" ? "Song + message" : "Song request";

  const disabled = !selectedSong || !isTakingRequests || submitting;

  return (
    <section
      aria-label="Payment summary"
      className={
        flush
          ? ""
          : "overflow-hidden rounded-card border border-white/10 bg-surface-raised"
      }
    >
      <div
        className={
          flush ? "space-y-2.5" : "space-y-2.5 p-3.5 sm:p-5"
        }
      >
        {/*
          No £0 line for the message. Song + message is its own price,
          not an extra on top of a song request, so listing it as a free
          add-on would misdescribe what the DJ actually charges.
        */}
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-zinc-400">{requestLabel}</span>
          <span className="text-sm font-semibold tabular-nums text-white">
            {money(requestAmount)}
          </span>
        </div>

        {isVip && (
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm text-zinc-400">Skip the queue</span>
            <span className="text-sm font-semibold tabular-nums text-amber-300">
              {money(VIP_PRICE)}
            </span>
          </div>
        )}

        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-zinc-400">Service fee</span>
          <span className="text-sm font-semibold tabular-nums text-white">
            {money(SERVICE_FEE)}
          </span>
        </div>
      </div>

      <div
        className={
          flush
            ? "mt-3.5 border-t border-white/10 pt-3.5"
            : "border-t border-white/10 p-3.5 sm:p-5"
        }
      >
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm font-semibold text-white">Total</span>
          <span className="text-2xl font-bold tabular-nums tracking-tight">
            {money(totalAmount)}
          </span>
        </div>

        {/*
          The authorise-then-capture promise, kept short and kept next to
          the total rather than buried in the legal line. It is the
          single most reassuring true thing we can say here, and it is
          exactly what the Stripe flow does: the card is authorised now
          and only captured if the DJ accepts.
        */}
        <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-5 text-zinc-500">
          <ShieldCheck
            size={13}
            aria-hidden
            className="mt-0.5 shrink-0 text-accent"
          />
          You&apos;re only charged if the DJ accepts. Declined or expired
          requests are never taken.
        </p>

        <Button
          size="lg"
          className="mt-3.5 w-full"
          disabled={disabled}
          /* aria-busy rather than swapping the accessible name mid-press,
             so the button keeps its identity while it works. */
          aria-busy={submitting}
          onClick={onCheckout}
        >
          {submitting
            ? "Opening payment..."
            : !isTakingRequests
              ? "Requests unavailable"
              : `Pay ${money(totalAmount)}`}
        </Button>

        {/*
          A separate row rather than links buried mid-sentence. They were
          16px inline targets inside a paragraph; splitting them out lets
          each one carry a real touch target without turning a sentence
          into a wall of buttons.
        */}
        <p className="mt-3 text-center text-[11px] text-zinc-600">
          Secure payment by Stripe
        </p>

        <div className="mt-1 flex items-center justify-center">
          <Link
            href="/legal/guest-terms"
            className="inline-flex min-h-11 items-center rounded px-3 text-[11px] text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Guest Terms
          </Link>

          <span aria-hidden className="text-[11px] text-zinc-700">
            ·
          </span>

          <Link
            href="/legal/refund-policy"
            className="inline-flex min-h-11 items-center rounded px-3 text-[11px] text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Refund Policy
          </Link>
        </div>
      </div>
    </section>
  );
}
