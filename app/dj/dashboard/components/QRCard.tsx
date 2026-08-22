import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check, ChevronRight, Download, Printer } from "lucide-react";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import Eyebrow from "@/src/components/ui/Eyebrow";
import dynamic from "next/dynamic";

/*
 * Only opened when the DJ taps "Print your QR code", which is a
 * once-per-setup action, and it carries its own QRCode + canvas code.
 * No reason for it to be in the bundle every DJ downloads to run a gig.
 */
const QRFormatsModal = dynamic(() => import("./QRFormatsModal"), {
  ssr: false,
});

type Props = {
  showQr: boolean;
  setShowQr: (value: boolean) => void;
  qrCodeUrl: string;
  requestLink: string;
  displayRequestLink: string;
  djName: string;
  djSlug: string;
};

export default function QRCard({
  qrCodeUrl,
  requestLink,
  displayRequestLink,
  djName,
  djSlug,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showFormats, setShowFormats] = useState(false);

  /*
   * Saving the QR from a phone.
   *
   * This was <a href={dataUrl} download>. The download attribute is
   * ignored by iOS Safari, and a data: URL there simply navigates or
   * does nothing at all, so on a phone the button appeared dead. Blob
   * URLs are handled far more consistently than data: URLs, and on
   * mobile the genuinely native action is the share sheet, which offers
   * "Save Image" straight to Photos or Files.
   *
   * The data URL is decoded synchronously with atob rather than through
   * fetch(). Awaiting anything before navigator.share() loses the user
   * gesture on iOS and the share sheet is then refused.
   */
  const dataUrlToBlob = (dataUrl: string) => {
    const [header, encoded] = dataUrl.split(",");
    const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type: mime });
  };

  const handleDownloadQr = async () => {
    if (!qrCodeUrl || saving) return;

    setSaving(true);

    try {
      const blob = dataUrlToBlob(qrCodeUrl);
      const filename = `${djSlug || "playing-next"}-qr-code.png`;
      const file = new File([blob], filename, { type: blob.type });

      /* Share sheet where it exists and accepts a file: this is what
         puts the image in the DJ's camera roll on a phone. */
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My Playing Next QR code" });
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      /* Revoked on the next tick, not immediately: revoking before the
         browser has started the download cancels it. */
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    } catch (error) {
      /* A cancelled share sheet is a normal outcome, not a failure. */
      if ((error as Error)?.name === "AbortError") return;

      console.log("QR download error:", error);
      toast.error(
        "Couldn't save the QR code. Press and hold the code above to save it instead."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(requestLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card variant="elevated" className="overflow-hidden">
      <div className="p-4 sm:p-8">
        <div className="flex flex-col gap-5 sm:gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-lg">
            <Eyebrow tone="accent">Share</Eyebrow>

            <h2 className="mt-2.5 text-[1.5rem] font-bold tracking-tight sm:text-h2">
              Your request page
            </h2>

            <p className="mt-2 text-[0.95rem] leading-6 text-zinc-400 sm:mt-3 sm:text-base">
              Guests scan your QR code to send requests straight to this
              dashboard.
            </p>

            <div className="mt-5 rounded-control border border-white/5 bg-black/20 p-3.5 sm:mt-6 sm:p-4">
              <p className="truncate text-sm text-zinc-400">
                {displayRequestLink}
              </p>
            </div>

            {/*
              The three sharing actions are one group, not two buttons
              with a stray third underneath. They share a container, a
              gap and a full-bleed width, so Download and Copy read as
              the pair they are and Print reads as the deliberate
              secondary step below them rather than as an odd-sized
              button that happened to land there.
            */}
            <div className="mt-4 space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <Button
                variant="secondary"
                className="w-full"
                onClick={handleDownloadQr}
                disabled={!qrCodeUrl || saving}
              >
                <Download size={16} />
                {/*
                 * "Download QR" wraps onto a second line in a half-width
                 * button at 375-430px while "Copy Link" stays on one, which
                 * made the pair look accidental. "Save" is also the more
                 * honest verb on a phone, where this opens the share sheet
                 * and the guest-facing action is Save Image.
                 */}
                <span className="whitespace-nowrap">
                  {saving ? (
                    "Saving..."
                  ) : (
                    <>
                      <span className="sm:hidden">Save QR</span>
                      <span className="hidden sm:inline">Download QR</span>
                    </>
                  )}
                </span>
              </Button>

              <Button className="w-full" onClick={handleCopyLink}>
                {copied ? (
                  <>
                    <Check size={16} />{" "}
                    <span className="whitespace-nowrap">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />{" "}
                    <span className="whitespace-nowrap">Copy Link</span>
                  </>
                )}
              </Button>
            </div>

            {/*
              Was an inline text link reading "Get a printable card,
              poster or wallpaper". At phone widths that label is wider
              than the column, so it wrapped mid-phrase while the icon
              stayed centred against the resulting two-line block, which
              read as cramped rather than considered.

              Splitting it into an action and what you get makes the
              line break deliberate instead of accidental, and both
              lines then fit their measure. It is a real destination, so
              it gets a row with its own target height rather than
              behaving like body text.
            */}
            <button
              type="button"
              onClick={() => setShowFormats(true)}
              /*
                Full width at every breakpoint. On desktop it used to
                shrink to its content while the two buttons above it
                spanned the column, which is what made it look like a
                leftover rather than part of the set.
              */
              className="flex min-h-14 w-full items-center gap-3 rounded-control border border-white/10 bg-white/5 px-4 text-left transition hover:border-accent/30 hover:bg-accent/10"
            >
              <Printer size={18} className="shrink-0 text-accent" />

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-accent">
                  Print your QR code
                </span>
                <span className="block truncate text-xs text-zinc-500">
                  Table cards, posters and wallpaper
                </span>
              </span>

              <ChevronRight size={16} className="shrink-0 text-zinc-500" />
            </button>
            </div>
          </div>

          <div className="flex justify-center">
            {/*
              Smaller on a phone. At w-56 plus padding the code alone
              was 256px, and the whole card 648px — the largest section
              on the mobile dashboard, for secondary content sitting
              below the live workspace. A 160px code is still
              comfortably scannable from a table, and a DJ who needs it
              larger has Print and Download right above.
            */}
            {qrCodeUrl && (
              <div className="rounded-card bg-white p-3 shadow-2xl sm:p-5">
                {/* eslint-disable-next-line @next/next/no-img-element --
                    a client-generated data: URL. next/image has nothing
                    to fetch, resize or cache here, and routing a data
                    URL through the optimizer only adds work. */}
                <img
                  src={qrCodeUrl}
                  alt={`QR code linking to ${djName}'s request page`}
                  className="w-40 max-w-full sm:w-72"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {showFormats && (
        <QRFormatsModal
          djName={djName}
          djSlug={djSlug}
          requestLink={requestLink}
          onClose={() => setShowFormats(false)}
        />
      )}
    </Card>
  );
}
