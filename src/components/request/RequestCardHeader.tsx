import Eyebrow from "@/src/components/ui/Eyebrow";

export default function RequestCardHeader() {
  return (
    <div>
      <Eyebrow tone="accent">Song requests</Eyebrow>

      <h2 className="mt-3 text-h1">What should the DJ play?</h2>

      <p className="mt-3 max-w-xl leading-7 text-zinc-400">
        Search Spotify, choose your track and send it directly to the DJ.
      </p>
    </div>
  );
}
