/*
 * A group of setting rows under one heading.
 *
 * What this replaces: six cards, each an expanded form, every input and
 * every explanatory paragraph visible at once. A DJ opening Settings to
 * change one price had to read the whole page to find it. Grouped rows
 * are browsable — label on the left, current value on the right, and
 * the explanation only where a value is being changed.
 */
export default function SettingsGroup({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  /** One short note for the whole group, where a note is needed at all.
   *  Cheaper than repeating a caveat on every row it applies to. */
  footer?: React.ReactNode;
}) {
  return (
    <section className="mt-5 first:mt-4">
      <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
        {title}
      </h2>

      {/* divide-y rather than a border per row: one hairline between
          rows and none at the card's own edges, which is what stops a
          list of settings reading as a stack of separate cards. */}
      <ul className="mt-2 divide-y divide-white/5 overflow-hidden rounded-card border border-white/10 bg-surface-raised">
        {children}
      </ul>

      {footer && (
        <p className="mt-2 px-1 text-xs leading-5 text-zinc-400">{footer}</p>
      )}
    </section>
  );
}
