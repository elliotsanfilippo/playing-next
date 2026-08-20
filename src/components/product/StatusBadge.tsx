import Badge from "@/src/components/ui/Badge";
import {
  requestStatusTone,
  requestStatusLabel,
  type StatusAudience,
} from "@/src/lib/requestStatus";

type Props = {
  status: string;
  /** Whose language to use — see requestStatusLabel. */
  audience?: StatusAudience;
  /** Live states read better with a dot; terminal ones don't need it. */
  dot?: boolean;
  className?: string;
};

/*
 * The one way a request's state is displayed. Takes a raw status string
 * straight from the database and resolves both its colour and its
 * wording through src/lib/requestStatus.ts, so adding a new status is a
 * single-file change rather than a hunt through every surface.
 */
export default function StatusBadge({
  status,
  audience = "dj",
  dot = true,
  className,
}: Props) {
  return (
    <Badge tone={requestStatusTone(status)} dot={dot} className={className}>
      {requestStatusLabel(status, audience)}
    </Badge>
  );
}
