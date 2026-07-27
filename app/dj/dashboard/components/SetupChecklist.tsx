import type { DJProfile } from "@/src/types/dashboard";

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
    <section className="mt-8 overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950">
      <div className="p-8">

        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
              READY TO GO LIVE
            </p>

            <h2 className="mt-3 text-4xl font-bold">
              {completed === 5
                ? "You're ready 🎉"
                : "You're almost ready"}
            </h2>

            <p className="mt-3 max-w-xl text-zinc-400">
              Complete the remaining steps to start taking song requests from your audience.
            </p>
          </div>

          <div className="text-right">
            <div className="text-5xl font-black">
              {completed}
              <span className="text-zinc-500">
                /5
              </span>
            </div>

            <p className="mt-1 text-sm text-zinc-500">
              Completed
            </p>
          </div>

        </div>

        <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">

          {tasks.map((task) => (
            <div
              key={task.title}
              className={`rounded-3xl border p-5 transition ${
                task.complete
                  ? "border-green-500/10 bg-green-500/5"
                  : "border-white/5 bg-zinc-950/60"
              }`}
            >
              <div className="flex items-start justify-between">

                <div>

                  <div className="flex items-center gap-3">

                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                        task.complete
                          ? "bg-green-500 text-black"
                          : "bg-white/5 text-zinc-400"
                      }`}
                    >
                      {task.complete ? "✓" : "•"}
                    </div>

                    <div>
                      <h3 className="font-semibold">
                        {task.title}
                      </h3>

                      <p className="text-sm text-zinc-500">
                        {task.description}
                      </p>
                    </div>

                  </div>

                </div>

              </div>
            </div>
          ))}

        </div>

      </div>
    </section>
  );
}