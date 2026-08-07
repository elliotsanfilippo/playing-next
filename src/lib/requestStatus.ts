export type StatusTone = "accent" | "danger" | "warning" | "info" | "neutral";

const STATUS_TONE: Record<string, StatusTone> = {
  checkout_pending: "warning",
  pending: "warning",
  accepted: "accent",
  playing_next: "info",
  played: "neutral",
  declined: "danger",
};

export function requestStatusTone(status: string): StatusTone {
  return STATUS_TONE[status] ?? "warning";
}
