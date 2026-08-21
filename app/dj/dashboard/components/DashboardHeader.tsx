"use client";

import { useEffect, useRef, useState } from "react";
import type { DJProfile } from "@/src/types/dashboard";
import {
  MonitorPlay,
  BarChart3,
  PoundSterling,
  Settings as SettingsIcon,
  Pause,
  Play,
  LogOut,
  QrCode,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/src/lib/cn";
import AutoCloseControl from "./AutoCloseControl";

type Props = {
  djProfile: DJProfile | null;
  isTakingRequests: boolean;
  toggleRequests: () => Promise<void>;
  isPro: boolean;
  setAutoClose: (minutes: number | null) => Promise<void>;
  logout: () => Promise<void>;
  onShowQr: () => void;
  router: {
    push: (path: string) => void;
  };
};

/*
 * The live bar.
 *
 * One responsive tree, not two. The previous version maintained a
 * separate `lg:hidden` block and a `hidden lg:flex` block, each
 * re-implementing identity, greeting, genres, status and the autoclose
 * control — so every change had to be made twice and the two drifted.
 *
 * Priority order is the DJ's, not the org chart's: what state am I in,
 * how do I change it, where's my QR. Analytics, Earnings, Settings and
 * Log Out are real but not live-set actions, so they sit behind the
 * overflow menu on every breakpoint. That is also what stops this
 * reading as a generic admin toolbar: it used to render six buttons in
 * a row.
 *
 * Sticky, because pausing requests is the one control a DJ may need
 * instantly and scrolling to find it mid-set is not acceptable.
 */
export default function DashboardHeader({
  djProfile,
  isTakingRequests,
  toggleRequests,
  isPro,
  setAutoClose,
  logout,
  onShowQr,
  router,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState<"toggle" | "logout" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleToggle = async () => {
    if (pending) return;

    setPending("toggle");

    try {
      await toggleRequests();
    } finally {
      setPending(null);
    }
  };

  const handleLogout = async () => {
    if (pending) return;

    setPending("logout");

    try {
      await logout();
    } finally {
      setPending(null);
    }
  };

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const menuItems = [
    djProfile?.slug && {
      label: "Display screen",
      icon: MonitorPlay,
      onClick: () =>
        window.open(`/request/${djProfile.slug}/queue`, "_blank"),
    },
    {
      label: "Earnings",
      icon: PoundSterling,
      onClick: () => router.push("/dj/earnings"),
    },
    {
      label: "Analytics",
      icon: BarChart3,
      onClick: () => router.push("/dj/analytics"),
    },
    {
      label: "Settings",
      icon: SettingsIcon,
      onClick: () => router.push("/dj/settings"),
    },
    {
      label: "Log out",
      icon: LogOut,
      onClick: handleLogout,
      danger: true,
    },
  ].filter(Boolean) as {
    label: string;
    icon: typeof MonitorPlay;
    onClick: () => void;
    danger?: boolean;
  }[];

  /*
   * State and action are one control group visually and two elements
   * semantically: a <span> that says what is true right now, and a
   * <button> that says what tapping will do. Merging them into a single
   * toggle would save space and make the most consequential control on
   * the dashboard ambiguous — "Taking Requests" would have to mean both
   * the current state and the thing about to happen.
   */
  const statusControl = (
    <div
      className={cn(
        /* h-12 on phones: the inner button loses 2px to the group's
           border, and pausing requests is a consequential one-handed
           action that should clear the 44px touch-target minimum
           comfortably rather than by 0px. */
        /*
         * h-12 up to lg, not sm. The inner Pause button is h-full inside
         * a bordered group, so it loses 2px to the border: at h-11 that
         * left it 42px, which is under the target minimum on a tablet —
         * still a touch device. Desktop drops to h-11 because a mouse
         * does not need the same margin and it keeps the pill level with
         * the icon buttons beside it.
         */
        "inline-flex h-12 shrink-0 items-center overflow-hidden rounded-full border lg:h-11",
        isTakingRequests
          ? "border-accent/25 bg-accent/10"
          : "border-status-declined/25 bg-status-declined/10"
      )}
    >
      <span
        aria-live="polite"
        className={cn(
          "flex items-center gap-2 pl-3.5 pr-3 text-[13px] font-semibold sm:text-sm",
          isTakingRequests ? "text-accent" : "text-status-declined"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            isTakingRequests ? "bg-accent" : "bg-status-declined"
          )}
        />
        {/*
         * "Requests paused" made the status group 251px wide, and with the
         * icon buttons beside it the sticky bar overflowed the viewport by
         * 12px at 375px. Nothing in the bar may shrink, so the label has to
         * give. "Paused" next to a red dot and a Resume button is not
         * ambiguous, and the full wording returns from sm upward.
         */}
        <span className="whitespace-nowrap">
          {isTakingRequests ? (
            "Taking requests"
          ) : (
            <>
              <span className="sm:hidden">Paused</span>
              <span className="hidden sm:inline">Requests paused</span>
            </>
          )}
        </span>
      </span>

      <button
        type="button"
        onClick={handleToggle}
        disabled={pending === "toggle"}
        className={cn(
          "flex h-full items-center gap-1.5 border-l px-3.5 text-[13px] font-bold transition-colors disabled:opacity-60 sm:text-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40",
          isTakingRequests
            ? "border-accent/25 text-accent hover:bg-accent/15"
            : "border-status-declined/25 text-status-declined hover:bg-status-declined/15"
        )}
      >
        {isTakingRequests ? <Pause size={13} /> : <Play size={13} />}
        {pending === "toggle"
          ? "..."
          : isTakingRequests
            ? "Pause"
            : "Resume"}
      </button>
    </div>
  );

  const iconButton =
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 lg:h-11 lg:w-11 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60";

  return (
    /*
     * z-40 keeps the bar over dashboard content but under the app's
     * modals, which sit at z-50.
     */
    /*
     * z-[10000] and a fully opaque fill, matching the site header.
     *
     * The film grain in globals.css is a fixed full-viewport layer at
     * z-index 9999 using mix-blend-mode. Everything it covers has to be
     * rasterised together with it as one blending group, and a bar
     * trapped inside that group cannot be promoted to its own
     * compositing layer — which is what lets it lag behind the page
     * during scrolling on mobile. This bar was at z-40, so it was
     * inside the group. Lifting it above frees it to composite on its
     * own, exactly as the fix on the marketing header did.
     *
     * bg-canvas/95 also let content read faintly through it, which
     * compounds the impression of drift. A solid bar cannot show
     * anything through it.
     *
     * It stays sticky rather than becoming fixed: sticky already
     * reserves its own space in the flow, so there is no content offset
     * to maintain and no layout jump. The homepage header is fixed
     * because it floats over a scene that starts at the top of the
     * page; this one sits at the top of a normal document.
     */
    <header className="sticky top-0 z-[10000] -mx-5 mb-4 border-b border-white/10 bg-canvas px-5 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] sm:-mx-6 sm:mb-6 sm:px-6 sm:pb-4 sm:pt-[max(env(safe-area-inset-top),1rem)]">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        {/* Identity is desktop-only. On a phone the DJ knows who they
            are, and those pixels belong to the live controls. */}
        <div className="hidden min-w-0 items-center gap-3 lg:flex">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/10">
            {djProfile?.profile_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={djProfile.profile_image_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-zinc-900" />
            )}
          </div>

          <p className="truncate text-lg font-bold tracking-tight">
            {djProfile?.dj_name || "DJ Dashboard"}
          </p>
        </div>

        {statusControl}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/* QR is a live-set action — a DJ points a guest at it mid-set
              — so it keeps a permanent slot rather than sitting in the
              menu next to Analytics. */}
          <button
            type="button"
            onClick={onShowQr}
            aria-label="Show QR code and request link"
            className={iconButton}
          >
            <QrCode size={18} />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="More options"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className={iconButton}
            >
              <MoreHorizontal size={18} />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-card border border-white/10 bg-surface-overlay shadow-2xl shadow-black/50"
              >
                {/* Auto close lives here at every width now. It is a
                    useful control but not a live one — the header is for
                    state you change mid-set, and a scheduling picker
                    does not need permanent top-level space. */}
                <div className="border-b border-white/10 p-3">
                  <AutoCloseControl
                    isPro={isPro}
                    isTakingRequests={isTakingRequests}
                    autoCloseAt={djProfile?.auto_close_at}
                    onSetAutoClose={setAutoClose}
                  />
                </div>

                {menuItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    disabled={item.danger && pending === "logout"}
                    onClick={() => {
                      setMenuOpen(false);
                      item.onClick();
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition-colors disabled:opacity-60",
                      item.danger
                        ? "text-status-declined hover:bg-status-declined/10"
                        : "text-zinc-200 hover:bg-white/5"
                    )}
                  >
                    <item.icon size={16} className="shrink-0" />
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
