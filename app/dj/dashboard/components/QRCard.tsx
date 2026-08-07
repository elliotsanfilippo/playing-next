import { Copy, Download } from "lucide-react";
import Card from "@/src/components/ui/Card";
import Button, { buttonVariants } from "@/src/components/ui/Button";
import Eyebrow from "@/src/components/ui/Eyebrow";

type Props = {
  showQr: boolean;
  setShowQr: (value: boolean) => void;
  qrCodeUrl: string;
  requestLink: string;
  displayRequestLink: string;
};

export default function QRCard({
  qrCodeUrl,
  requestLink,
  displayRequestLink,
}: Props) {
  return (
    <Card variant="elevated" className="mt-8 overflow-hidden">
      <div className="p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-lg">
            <Eyebrow tone="accent">Share</Eyebrow>

            <h2 className="mt-3 text-h2">Your Request Page</h2>

            <p className="mt-3 text-zinc-400">
              Guests simply scan your QR code to send song requests directly
              to your dashboard.
            </p>

            <div className="mt-6 rounded-control border border-white/5 bg-black/20 p-4">
              <p className="truncate text-sm text-zinc-400">
                {displayRequestLink}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                onClick={() => navigator.clipboard.writeText(requestLink)}
              >
                <Copy size={16} /> Copy Link
              </Button>

              <a
                href={qrCodeUrl}
                download="playing-next-qr-code.png"
                className={buttonVariants({ variant: "secondary" })}
              >
                <Download size={16} /> Download QR
              </a>
            </div>
          </div>

          <div className="flex justify-center">
            {qrCodeUrl && (
              <div className="rounded-card bg-white p-5 shadow-2xl">
                <img src={qrCodeUrl} alt="QR Code" className="w-56" />
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
