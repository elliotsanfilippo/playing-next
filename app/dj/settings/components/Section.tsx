/*
 * One card per group, each with a real heading.
 *
 * The old page was a single card holding identity, pricing, capacity,
 * plan, payments and notifications in one flat stack with no headings
 * between them — 3036px of undifferentiated form at 320px, and a
 * heading outline that ran h1, h3, h4, h3, h3 with no h2 anywhere and a
 * plan value ("Free") rendered as a heading.
 */
export default function Section({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="mt-4 overflow-hidden rounded-card border border-white/10 bg-surface-raised">
      <div className="p-4 sm:p-6">
        <h2 className="text-sm font-bold tracking-tight text-white">{title}</h2>

        {description && (
          <p className="mt-1 text-xs leading-5 text-zinc-400">{description}</p>
        )}

        <div className="mt-4 space-y-5">{children}</div>
      </div>

      {footer && (
        <div className="border-t border-white/5 bg-black/20 px-4 py-3.5 sm:px-6">
          {footer}
        </div>
      )}
    </section>
  );
}
