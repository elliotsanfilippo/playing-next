/*
 * The explicit indicator.
 *
 * Deliberately the quiet grey square the streaming services use rather
 * than anything red or warning-shaped: it is a fact about the track, not
 * a problem with the guest's choice, and nothing filters or blocks on
 * it. The letter is decorative — the accessible name carries the whole
 * word, since a screen reader reading out "E" would be meaningless.
 */
export default function ExplicitMark() {
  return (
    <span
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] bg-zinc-600 text-[9px] font-bold leading-none text-zinc-950"
      title="Explicit"
    >
      <span aria-hidden>E</span>
      <span className="sr-only">Explicit</span>
    </span>
  );
}
