"use client";

import { Music4, Heart, Crown } from "lucide-react";
import MoneyValue from "@/src/components/product/MoneyValue";
import { requestStatusLabel, requestStatusTone } from "@/src/lib/requestStatus";
import { toneDotClasses } from "@/src/components/ui/Badge";
import type { Transaction } from "@/src/lib/earnings";
import { cn } from "@/src/lib/cn";

/*
 * Tips have their own status vocabulary — the request map has no
 * "succeeded", and a tip is not a request.
 */
const TIP_LABEL: Record<string, string> = {
  succeeded: "Received",
  pending: "Not completed",
  expired: "Not completed",
  refunded: "Refunded",
  disputed: "Disputed",
};

const TIP_TONE: Record<string, keyof typeof toneDotClasses> = {
  succeeded: "accent",
  pending: "neutral",
  expired: "neutral",
  refunded: "danger",
  disputed: "danger",
};

export default function EarningsTransactionRow({
  transaction,
}: {
  transaction: Transaction;
}) {
  const isTip = transaction.kind === "tip";

  const label = isTip
    ? (TIP_LABEL[transaction.status] ?? transaction.status)
    : requestStatusLabel(transaction.status, "dj");

  const tone = isTip
    ? (TIP_TONE[transaction.status] ?? "neutral")
    : (requestStatusTone(transaction.status) as keyof typeof toneDotClasses);

  const when = new Date(transaction.createdAt);

  return (
    <div className="flex items-center gap-3 rounded-control border border-white/5 bg-surface-base/60 p-3">
      <span
        aria-hidden
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          isTip ? "bg-pink-500/10 text-pink-300" : "bg-white/5 text-zinc-400"
        )}
      >
        {isTip ? <Heart size={15} /> : <Music4 size={15} />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
          <span className="min-w-0 truncate">{transaction.title}</span>
          {transaction.isVip && (
            <>
              <Crown size={11} aria-hidden className="shrink-0 text-amber-400" />
              <span className="sr-only">VIP</span>
            </>
          )}
        </p>

        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-zinc-500">
          {/* Status is never colour alone: the dot carries the tone, the
              word carries the meaning. */}
          <span
            aria-hidden
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              toneDotClasses[tone]
            )}
          />
          <span className="shrink-0">{label}</span>
          <span aria-hidden className="text-zinc-700">
            ·
          </span>
          {/* Time, not date. Every row on a single day's list shows the
              same date, which tells the DJ nothing. */}
          <time
            dateTime={transaction.createdAt}
            className="shrink-0 tabular-nums"
          >
            {when.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
          {transaction.subtitle && (
            <>
              <span aria-hidden className="text-zinc-700">
                ·
              </span>
              <span className="min-w-0 truncate">{transaction.subtitle}</span>
            </>
          )}
        </p>
      </div>

      {/*
        An amount appears only where money was genuinely earned. A
        cancelled or expired request still carries a pricing snapshot,
        and rendering that beside real earnings made money that never
        existed look like income.
      */}
      <div className="shrink-0 text-right">
        {transaction.earned === null ? (
          <span className="text-xs text-zinc-600">No earnings</span>
        ) : (
          <MoneyValue
            pence={transaction.earned}
            compact={false}
            className="text-sm font-bold text-white"
          />
        )}
      </div>
    </div>
  );
}
