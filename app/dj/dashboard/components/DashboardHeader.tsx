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
  Menu,
  X,
} from "lucide-react";
import Button from "@/src/components/ui/Button";
import { cn } from "@/src/lib/cn";
import AutoCloseControl from "./AutoCloseControl";

type Props = {
  djProfile: DJProfile | null;
  isTakingRequests: boolean;
  toggleRequests: () => Promise<void>;
  isPro: boolean;
  setAutoClose: (minutes: number | null) => Promise<void>;
  logout: () => Promise<void>;
  router: {
    push: (path: string) => void;
  };
};

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Good night";
}

export default function DashboardHeader({
  djProfile,
  isTakingRequests,
  toggleRequests,
  isPro,
  setAutoClose,
  logout,
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

  const genres = Array.isArray(djProfile?.genres)
    ? djProfile.genres
    : djProfile?.genres
      ? [djProfile.genres]
      : [];

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
      label: "Display Screen",
      icon: MonitorPlay,
      onClick: () =>
        window.open(`/request/${djProfile.slug}/queue`, "_blank"),
    },
    {
      label: "Analytics",
      icon: BarChart3,
      onClick: () => router.push("/dj/analytics"),
    },
    {
      label: "Earnings",
      icon: PoundSterling,
      onClick: () => router.push("/dj/earnings"),
    },
    {
      label: "Settings",
      icon: SettingsIcon,
      onClick: () => router.push("/dj/settings"),
    },
    {
      label: "Log Out",
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

  const avatar = djProfile?.profile_image_url ? (
    <img
      src={djProfile.profile_image_url}
      alt={djProfile.dj_name}
      className="h-full w-full rounded-full object-cover"
    />
  ) : (
    <div className="h-full w-full rounded-full bg-zinc-900" />
  );

  const statusBadge = (
    <span
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold",
        isTakingRequests
          ? "border border-accent/20 bg-accent/15 text-accent"
          : "border border-red-500/20 bg-red-500/15 text-red-400"
      )}
    >
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full",
          isTakingRequests ? "bg-accent" : "bg-red-400"
        )}
      />

      {pending === "toggle"
        ? "Updating..."
        : isTakingRequests
          ? "Taking Requests"
          : "Requests Paused"}
    </span>
  );

  const autoCloseControl = (
    <AutoCloseControl
      isPro={isPro}
      isTakingRequests={isTakingRequests}
      autoCloseAt={djProfile?.auto_close_at}
      onSetAutoClose={setAutoClose}
    />
  );

  const pauseResumeButton = (
    <Button
      size="sm"
      variant={isTakingRequests ? "danger" : "accent"}
      className={
        isTakingRequests
          ? "border-transparent bg-red-500 text-white hover:bg-red-400"
          : ""
      }
      onClick={handleToggle}
      disabled={pending === "toggle"}
    >
      {isTakingRequests ? (
        <Pause size={14} className="mr-1.5" />
      ) : (
        <Play size={14} className="mr-1.5" />
      )}
      {pending === "toggle"
        ? "Updating..."
        : isTakingRequests
          ? "Pause Requests"
          : "Resume Requests"}
    </Button>
  );

  return (
    <header className="mb-8">
      {/* Mobile / tablet: identity on the left, avatar-triggered menu on the right */}
      <div className="lg:hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-400">
              👋 {getGreeting()}
            </p>

            <h1 className="mt-1 truncate text-3xl font-bold tracking-tight">
              {djProfile?.dj_name || "DJ Dashboard"}
            </h1>

            {genres.length > 0 && (
              <p className="mt-2 truncate text-sm text-zinc-400">
                {genres.join(" • ")}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {statusBadge}
              {pauseResumeButton}
              {autoCloseControl}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-white/10">
              {avatar}
            </div>

            <div className="relative shrink-0" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="Open menu"
                aria-expanded={menuOpen}
                className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5 transition active:scale-[0.96]"
              >
                {menuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full z-40 mt-3 w-64 overflow-hidden rounded-card border border-white/10 bg-zinc-950 shadow-2xl shadow-black/40">
                  {menuItems.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        item.onClick();
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-semibold transition",
                        item.danger
                          ? "text-red-400 hover:bg-red-500/10"
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
      </div>

      {/* Desktop: original side-by-side layout */}
      <div className="hidden lg:flex lg:items-start lg:justify-between lg:gap-6">
        <div className="flex min-w-0 items-center gap-5">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-white/10">
            {avatar}
          </div>

          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-400">
              👋 {getGreeting()}
            </p>

            <h1 className="mt-1 truncate text-5xl font-bold tracking-tight">
              {djProfile?.dj_name || "DJ Dashboard"}
            </h1>

            {genres.length > 0 && (
              <p className="mt-2 text-sm text-zinc-400">
                {genres.join(" • ")}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {statusBadge}
              {autoCloseControl}
            </div>
          </div>
        </div>

        <div className="flex w-auto flex-col items-end gap-3">
          <div className="flex w-full flex-wrap items-center justify-end gap-3">
            {djProfile?.slug && (
              <Button
                variant="secondary"
                onClick={() =>
                  window.open(`/request/${djProfile.slug}/queue`, "_blank")
                }
              >
                <MonitorPlay size={16} className="mr-2" />
                Display Screen
              </Button>
            )}

            <Button
              variant="secondary"
              onClick={() => router.push("/dj/analytics")}
            >
              Analytics
            </Button>

            <Button
              variant="secondary"
              onClick={() => router.push("/dj/earnings")}
            >
              Earnings
            </Button>

            <Button
              variant="secondary"
              onClick={() => router.push("/dj/settings")}
            >
              Settings
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              variant={isTakingRequests ? "danger" : "accent"}
              className={
                isTakingRequests
                  ? "border-transparent bg-red-500 text-white hover:bg-red-400"
                  : ""
              }
              onClick={handleToggle}
              disabled={pending === "toggle"}
            >
              {pending === "toggle"
                ? "Updating..."
                : isTakingRequests
                  ? "Pause Requests"
                  : "Resume Requests"}
            </Button>

            <Button
              variant="danger"
              onClick={handleLogout}
              disabled={pending === "logout"}
            >
              {pending === "logout" ? "Logging Out..." : "Log Out"}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
