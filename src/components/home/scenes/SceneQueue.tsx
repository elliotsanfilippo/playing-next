"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  BarChart3,
  Check,
  MonitorPlay,
  Music2,
  Pause,
  PoundSterling,
  Settings as SettingsIcon,
} from "lucide-react";
import RequestCard from "@/src/components/product/RequestCard";
import Badge from "@/src/components/ui/Badge";
import MoneyValue from "@/src/components/product/MoneyValue";
import Reveal from "./Reveal";
import { SPRING } from "@/src/lib/motion";
import { OPENING_REQUEST, SCENE_PLAYING_NEXT, SCENE_QUEUE } from "./storyData";

type Props = {
  /** True once the visitor accepted the opening request, so their
   *  track shows at the top of the queue here too. */
  accepted: boolean;
};

/*
 * Scene 2 — the dashboard, at full size.
 *
 * Mirrors the real DJ dashboard's actual hierarchy rather than an
 * invented marketing layout: identity and Taking Requests status on
 * top, then the stats row, then Playing Next, then the accepted queue.
 * The nav controls shown are the real ones (Display screen, Earnings,
 * Analytics, Settings, Pause) so a DJ recognises the interface before
 * they ever sign up.
 *
 * Queue rows are the shared <RequestCard> the real dashboard renders.
 */
const NAV_CONTROLS = [
  { Icon: MonitorPlay, label: "Display" },
  { Icon: PoundSterling, label: "Earnings" },
  { Icon: BarChart3, label: "Analytics" },
  { Icon: SettingsIcon, label: "Settings" },
];

export default function SceneQueue({ accepted }: Props) {
  const shouldReduceMotion = useReducedMotion();

  const queueCount = SCENE_QUEUE.length + (accepted ? 1 : 0);

  const stats = [
    { label: "Pending", value: "3", tone: "text-status-pending" },
    { label: "Queue", value: String(queueCount), tone: "text-status-playing" },
    { label: "Played", value: "11", tone: "text-white" },
    { label: "Tonight", value: "£86", tone: "text-accent" },
  ];

  return (
    <section
      id="dashboard"
      className="relative z-10 px-5 py-16 sm:px-6 sm:py-20 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
              Your booth, your call
            </p>
          </Reveal>

          <Reveal index={1}>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              You&apos;re still in control.
            </h2>
          </Reveal>

          <Reveal index={2}>
            <p className="mx-auto mt-4 max-w-lg leading-7 text-zinc-400">
              Accept, decline and reorder paid requests without
              interrupting your set. Nothing reaches your speakers
              unless you say so.
            </p>
          </Reveal>
        </div>

        <Reveal index={1} className="mt-12">
          <div className="relative rounded-card-lg border border-white/15 bg-surface-raised/70 p-4 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-2xl sm:p-6">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-x-8 -top-8 h-48 rounded-full bg-green-500/10 blur-[90px]"
            />

            {/* Identity + status + controls, as on the real dashboard */}
            <div className="relative flex flex-col gap-4 border-b border-white/5 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-blue-500" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                    Good evening
                  </p>
                  <p className="truncate text-lg font-bold">Your dashboard</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent" dot>
                  Taking Requests
                </Badge>

                <span className="hidden items-center gap-1.5 rounded-control border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 sm:inline-flex">
                  <Pause size={12} />
                  Pause
                </span>

                {NAV_CONTROLS.map(({ Icon, label }) => (
                  <span
                    key={label}
                    className="hidden items-center gap-1.5 rounded-control border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-400 lg:inline-flex"
                  >
                    <Icon size={12} />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Stats row */}
            <div className="relative mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/5 bg-surface-inset p-3 sm:p-4"
                >
                  <p className="text-[11px] text-zinc-500">{stat.label}</p>
                  <p
                    className={`mt-1.5 text-2xl font-bold tabular-nums ${stat.tone}`}
                  >
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Playing Next — above the queue, as in the real product */}
            <div className="relative mt-4 rounded-2xl border border-accent/15 bg-accent/[0.06] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                Playing next
              </p>

              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-500">
                  <Music2 size={20} className="text-white" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">
                    {SCENE_PLAYING_NEXT.title}
                  </p>
                  <p className="truncate text-sm text-zinc-500">
                    {SCENE_PLAYING_NEXT.artist}
                  </p>
                </div>

                <span className="hidden shrink-0 items-center gap-1.5 rounded-control bg-accent-strong px-3 py-2 text-xs font-bold text-black sm:inline-flex">
                  <Check size={13} strokeWidth={3} />
                  Mark as Played
                </span>

                <motion.span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent sm:hidden"
                  animate={
                    shouldReduceMotion
                      ? undefined
                      : { opacity: [1, 0.35, 1], scale: [1, 0.85, 1] }
                  }
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </div>

            {/* Accepted queue */}
            <div className="relative mt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Accepted queue
                </p>
                <p className="text-[11px] text-zinc-600">
                  {queueCount} requests
                </p>
              </div>

              <motion.div layout className="mt-3 space-y-2">
                {accepted && (
                  <motion.div
                    layout
                    initial={
                      shouldReduceMotion ? false : { opacity: 0, y: -12 }
                    }
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={SPRING.soft}
                  >
                    <RequestCard
                      title={OPENING_REQUEST.title}
                      artist={OPENING_REQUEST.artist}
                      position={1}
                      pence={OPENING_REQUEST.pence}
                      size="compact"
                      className="border-accent/30 bg-accent/[0.06]"
                      meta={
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-black">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      }
                    />
                  </motion.div>
                )}

                {SCENE_QUEUE.map((track, index) => (
                  <RequestCard
                    key={track.id}
                    title={track.title}
                    artist={track.artist}
                    position={index + (accepted ? 2 : 1)}
                    pence={track.pence}
                    size="compact"
                    animateLayout
                  />
                ))}
              </motion.div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
