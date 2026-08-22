"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import { supabase } from "@/src/lib/supabase";

export type ChargebackDispute = {
  id: string;
  description: string;
  disputed_amount: number;
  respond_by: string;
};

type Props = {
  disputes: ChargebackDispute[];
  onResolved: () => void;
};

export default function ChargebackBanner({ disputes, onResolved }: Props) {
  const [respondingId, setRespondingId] = useState<string | null>(null);

  /* Above the early return: hooks cannot run conditionally. */
  const [now, setNow] = useState(0);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const initial = setTimeout(tick, 0);
    const interval = setInterval(tick, 60_000);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  if (disputes.length === 0) return null;

  const respond = async (disputeId: string, response: "accept" | "dispute") => {
    if (respondingId) return;

    setRespondingId(disputeId);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const apiResponse = await fetch("/api/dj/chargebacks/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ disputeId, response }),
      });

      const result = await apiResponse.json();

      if (!apiResponse.ok) {
        toast.error(result.error || "Unable to record your response.");
        return;
      }

      toast.success(
        response === "accept"
          ? "Deducted from your payout."
          : "Flagged for review. We'll follow up."
      );

      onResolved();
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <Card variant="elevated" className="overflow-hidden border-red-500/20">
      <div className="p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-red-400">
            <AlertTriangle size={22} />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold">
              {disputes.length === 1
                ? "A charge was disputed"
                : `${disputes.length} charges were disputed`}
            </h2>

            <p className="mt-1 text-sm text-zinc-400">
              A guest disputed the payment with their bank. You have 7 days
              to respond before it&apos;s deducted from your payout automatically.
            </p>

            <div className="mt-5 space-y-3">
              {disputes.map((dispute) => {
                /*
                 * `now` is timer-driven state rather than Date.now()
                 * read here. Reading the clock during render makes the
                 * countdown depend on when React happens to re-render,
                 * so a banner could sit at "3 days left" indefinitely
                 * while the real deadline passed. 0 means not measured
                 * yet, which renders no figure for one tick.
                 */
                const daysLeft =
                  now === 0
                    ? null
                    : Math.max(
                        0,
                        Math.ceil(
                          (new Date(dispute.respond_by).getTime() - now) /
                            86_400_000
                        )
                      );

                return (
                  <div
                    key={dispute.id}
                    className="flex flex-col gap-3 rounded-control border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">
                        {dispute.description}
                      </p>

                      <p className="mt-1 text-sm text-zinc-500">
                        £{(dispute.disputed_amount / 100).toFixed(2)} ·{" "}
                        {daysLeft === null
                          ? "Respond before your payout is deducted"
                          : daysLeft > 0
                            ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left to respond`
                            : "Response window closing"}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={respondingId === dispute.id}
                        onClick={() => respond(dispute.id, "dispute")}
                      >
                        Dispute
                      </Button>

                      <Button
                        variant="danger"
                        size="sm"
                        disabled={respondingId === dispute.id}
                        onClick={() => respond(dispute.id, "accept")}
                      >
                        {respondingId === dispute.id
                          ? "Processing..."
                          : "Accept"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
