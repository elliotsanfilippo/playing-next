"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Heart } from "lucide-react";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import { Input, Textarea } from "@/src/components/ui/Input";
import { TIP_PRESETS_PENCE, isValidTipAmount } from "@/src/lib/tips";

type Props = {
  djSlug: string;
  isTakingRequests: boolean;
};

export default function TipCard({ djSlug, isTakingRequests }: Props) {
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

  const sendTip = async () => {
    if (!amountPence || !isValidTipAmount(amountPence) || submitting) {
      toast.error("Please choose a valid tip amount.");
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
    <Card variant="elevated" className="mt-6 p-6 sm:p-8">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-500/15 text-pink-400">
            <Heart size={18} />
          </div>

          <div>
            <h2 className="font-bold">Tip the DJ</h2>
            <p className="text-sm text-zinc-400">
              No song needed — just show some love.
            </p>
          </div>
        </div>

        <span className="text-sm font-semibold text-zinc-400">
          {open ? "Close" : "Send a tip"}
        </span>
      </button>

      {open && (
        <div className="mt-6 space-y-4 border-t border-white/5 pt-6">
          <div className="flex flex-wrap gap-2">
            {TIP_PRESETS_PENCE.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setSelectedPreset(preset);
                  setCustomAmount("");
                }}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                  selectedPreset === preset && !customAmount
                    ? "bg-accent-strong text-black"
                    : "border border-white/10 bg-white/5 text-zinc-200 hover:border-white/20"
                }`}
              >
                £{(preset / 100).toFixed(0)}
              </button>
            ))}

            <Input
              type="number"
              min="1"
              step="0.5"
              placeholder="Custom £"
              value={customAmount}
              onChange={(event) => {
                setCustomAmount(event.target.value);
                setSelectedPreset(null);
              }}
              className="h-auto w-28 py-2.5"
            />
          </div>

          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Add a short message (optional)"
            rows={2}
          />

          <Button
            onClick={sendTip}
            disabled={submitting || !amountPence}
            className="w-full"
          >
            {submitting
              ? "Opening..."
              : amountPence
                ? `Send £${(amountPence / 100).toFixed(2)} Tip`
                : "Send Tip"}
          </Button>
        </div>
      )}
    </Card>
  );
}
