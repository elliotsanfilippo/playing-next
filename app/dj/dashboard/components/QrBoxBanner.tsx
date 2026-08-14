"use client";

import { useState } from "react";
import { Gift, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import Button from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { supabase } from "@/src/lib/supabase";

type Props = {
  onDismissed: () => void;
};

type Mode = "default" | "confirmDismiss" | "claiming";

/*
 * Renders its own content only, no outer Card — the dashboard wraps
 * this together with EventsCard in one shared notifications strip, so
 * the two don't stack as separate full-height cards.
 */
export default function QrBoxBanner({ onDismissed }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<Mode>("default");
  const [recipientName, setRecipientName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const handleDismiss = async () => {
    if (dismissing) return;

    setDismissing(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const response = await fetch("/api/qr-box/dismiss", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!response.ok) {
        const result = await response.json();
        toast.error(result.error || "Unable to update your profile.");
        return;
      }

      onDismissed();
    } finally {
      setDismissing(false);
    }
  };

  const handleClaim = async () => {
    if (submitting) return;

    if (
      !recipientName.trim() ||
      !addressLine1.trim() ||
      !city.trim() ||
      !postcode.trim()
    ) {
      toast.error("Please fill in your name, address, city, and postcode.");
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const response = await fetch("/api/qr-box/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          recipientName,
          addressLine1,
          addressLine2,
          city,
          postcode,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.url) {
        toast.error(result.error || "Unable to start checkout.");
        return;
      }

      window.location.href = result.url;
    } finally {
      setSubmitting(false);
    }
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition hover:bg-white/[0.03] sm:items-center"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Gift size={15} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            Free QR display block
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            First 50 Pro DJs, just cover shipping
          </p>
        </div>

        <span className="flex shrink-0 items-center gap-1 self-center text-sm font-semibold text-accent">
          Claim <ChevronDown size={15} />
        </span>
      </button>
    );
  }

  return (
    <div className="p-6 sm:p-8">
      {mode === "default" && (
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <Gift size={22} />
            </div>

            <div>
              <p className="text-sm font-semibold text-accent">
                First 50 Pro DJs
              </p>

              <h2 className="mt-1 text-xl font-bold">
                Claim your free QR display block
              </h2>

              <p className="mt-1 text-sm text-zinc-400">
                You&apos;re one of the first 50 DJs to go Pro, so we&apos;ll
                send you a physical QR stand for your booth. You just cover
                shipping.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setExpanded(false)}>
              Later
            </Button>

            <Button
              variant="secondary"
              onClick={() => setMode("confirmDismiss")}
            >
              No thanks
            </Button>

            <Button variant="accent" onClick={() => setMode("claiming")}>
              Claim
            </Button>
          </div>
        </div>
      )}

      {mode === "confirmDismiss" && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-300">
            Are you sure? This is final: once dismissed, you won&apos;t be
            able to claim your free QR block later.
          </p>

          <div className="flex shrink-0 gap-3">
            <Button variant="secondary" onClick={() => setMode("default")}>
              Cancel
            </Button>

            <Button
              variant="danger"
              onClick={handleDismiss}
              disabled={dismissing}
            >
              {dismissing ? "Dismissing..." : "Yes, dismiss"}
            </Button>
          </div>
        </div>
      )}

      {mode === "claiming" && (
        <div>
          <h2 className="text-xl font-bold">Where should we send it?</h2>

          <p className="mt-1 text-sm text-zinc-400">
            UK addresses only for now. You&apos;ll pay a small shipping fee
            (£3.99) at checkout.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Input
              placeholder="Full name"
              value={recipientName}
              onChange={(event) => setRecipientName(event.target.value)}
              disabled={submitting}
              className="sm:col-span-2"
            />

            <Input
              placeholder="Address line 1"
              value={addressLine1}
              onChange={(event) => setAddressLine1(event.target.value)}
              disabled={submitting}
              className="sm:col-span-2"
            />

            <Input
              placeholder="Address line 2 (optional)"
              value={addressLine2}
              onChange={(event) => setAddressLine2(event.target.value)}
              disabled={submitting}
              className="sm:col-span-2"
            />

            <Input
              placeholder="City"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              disabled={submitting}
            />

            <Input
              placeholder="Postcode"
              value={postcode}
              onChange={(event) => setPostcode(event.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="mt-5 flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setMode("default")}
              disabled={submitting}
            >
              Back
            </Button>

            <Button
              variant="accent"
              onClick={handleClaim}
              disabled={submitting}
            >
              {submitting ? "Starting checkout..." : "Continue to Payment"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
