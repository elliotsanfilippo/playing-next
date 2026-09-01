"use client";

import { Flag } from "lucide-react";
import Card from "@/src/components/ui/Card";
import Badge from "@/src/components/ui/Badge";
import Button from "@/src/components/ui/Button";
import type { Report } from "@/src/components/admin/crmTypes";

export default function ReportsView({
  reports,
  resolvingId,
  onResolve,
}: {
  reports: Report[];
  resolvingId: string | null;
  onResolve: (id: string, resolution: "refunded" | "denied") => void;
}) {
  const pending = reports.filter((r) => r.resolution === "pending");
  const resolved = reports.filter((r) => r.resolution !== "pending");

  return (
    <>
      <div className="border-b border-white/5 p-5">
        <p className="text-sm text-text-muted">
          {pending.length > 0 ? (
            <span className="font-semibold text-status-pending">
              {pending.length} awaiting a decision
            </span>
          ) : (
            "Nothing awaiting a decision."
          )}
        </p>
        <p className="mt-1.5 text-sm text-text-muted">
          A guest paid for a song and says it was never played. Each one is
          money owed back or a claim to deny.
        </p>
      </div>

      <div className="divide-y divide-white/5">
        {reports.length === 0 ? (
          <div className="p-10 text-center">
            <Flag size={22} className="mx-auto text-text-muted" aria-hidden />
            <p className="mt-3 text-sm text-zinc-300">No reports. Nothing owed.</p>
            <p className="mt-1 text-sm text-text-muted">
              Guests have not reported a single unplayed request.
            </p>
          </div>
        ) : (
          [...pending, ...resolved].map((report) => (
            <div
              key={report.id}
              className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Flag size={14} className="text-text-muted" />
                  <p className="font-semibold text-white">
                    {report.song_requests?.song_title || "Unknown song"}
                  </p>
                  <span className="text-text-muted">
                    {report.song_requests?.artist}
                  </span>
                </div>

                <p className="mt-1 text-sm text-text-muted">
                  {report.dj_profiles?.dj_name || "Unknown DJ"} ·{" "}
                  {new Date(report.created_at).toLocaleString()}
                </p>

                {report.reason && (
                  <p className="mt-2 rounded-control border border-white/10 bg-black/20 p-3 text-sm text-zinc-300">
                    {report.reason}
                  </p>
                )}

                <Badge
                  tone={
                    report.resolution === "pending"
                      ? "warning"
                      : report.resolution === "refunded"
                        ? "accent"
                        : "neutral"
                  }
                  className="mt-3"
                >
                  {report.resolution}
                </Badge>
              </div>

              {report.resolution === "pending" && (
                <div className="flex shrink-0 gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onResolve(report.id, "denied")}
                    disabled={resolvingId === report.id}
                  >
                    Deny
                  </Button>
                  <Button
                    variant="accent"
                    size="sm"
                    onClick={() => onResolve(report.id, "refunded")}
                    disabled={resolvingId === report.id}
                  >
                    Mark Refunded
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
