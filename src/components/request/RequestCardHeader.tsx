type Props = {
  requestPrice: number;
  shoutoutPrice: number;
};

export default function RequestCardHeader() {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-400">
        Song requests
      </p>

      <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        What should the DJ play?
      </h2>

      <p className="mt-3 max-w-xl leading-7 text-zinc-400">
        Search Spotify, choose your track and send it directly to the DJ.
      </p>
    </div>
  );
}