import { Check } from "lucide-react";
import type { DJProfile } from "@/src/types/dashboard";
import Card from "@/src/components/ui/Card";
import Eyebrow from "@/src/components/ui/Eyebrow";

type Props = {
  djProfile: DJProfile | null;
  qrCodeUrl: string;
};

export default function SetupChecklist({
  djProfile,
  qrCodeUrl,
}: Props) {
  if (!djProfile) return null;

  const tasks = [
    {
      complete: djProfile.dj_name !== "New DJ",
      title: "Profile",
      description: "Your public DJ profile",
    },
    {
      complete: (djProfile.request_price || 0) > 0,
      title: "Request Pricing",
      description: "Guests can send paid requests",
    },
    {
      complete: Boolean(djProfile.profile_image_url),
      title: "Profile Photo",
      description: "Add your DJ image",
    },
    {
      complete: Boolean(qrCodeUrl),
      title: "QR Code",
      description: "Ready to share",
    },
    {
      complete: Boolean(djProfile.stripe_connected),
      title: "Stripe",
      description: "Receive payments",
    },
  ];

  const completed = tasks.filter((t) => t.complete).length;
  const progress = (completed / tasks.length) * 100;

  return (
    <Card variant="elevated" className="mt-8 overflow-hidden">
      <div className="p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Eyebrow tone="accent">Ready to go live</Eyebrow>

            <h2 className="mt-3 text-h2">
              {completed === 5 ? "You're ready 🎉" : "You're almost ready"}
            </h2>

            <p className="mt-3 max-w-xl text-zinc-400">
              Complete the remaining steps to start taking song requests
              from your audience.
            </p>
          </div>

          <div className="text-right">
            <div className="text-5xl font-black">
              {completed}
              <span className="text-zinc-500">/5</span>
            </div>

            <p className="mt-1 text-sm text-zinc-500">Completed</p>
          </div>
        </div>

        <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-accent-strong transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {tasks.map((task) => (
            <div
              key={task.title}
              className={`rounded-card border p-5 transition ${
                task.complete
                  ? "border-accent/10 bg-accent/5"
                  : "border-white/5 bg-zinc-950/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                    task.complete
                      ? "bg-accent-strong text-black"
                      : "bg-white/5 text-zinc-400"
                  }`}
                >
                  {task.complete ? (
                    <Check size={16} strokeWidth={3} />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </div>

                <div>
                  <h3 className="font-semibold">{task.title}</h3>

                  <p className="text-sm text-zinc-500">
                    {task.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
