/*
 * ── Naming a DJ who never named themselves ────────────────────────
 *
 * Nine of sixteen accounts are still called "New DJ", the signup
 * default, which made the Admin list read as a column of the same
 * person repeated. The slug is the honest fallback: it is already
 * public, because it is the address of their request page, and it is
 * always present.
 *
 * Nothing private is ever used for this. No email, no user id, no
 * Stripe identifier, whatever it would do for legibility.
 */
const PLACEHOLDER_NAMES = new Set(["new dj", "dj", ""]);

export function hasRealName(djName: string | null | undefined): boolean {
  return !!djName && !PLACEHOLDER_NAMES.has(djName.trim().toLowerCase());
}

/** What to show as the person's primary identity. */
export function displayIdentity(
  djName: string | null | undefined,
  slug: string | null | undefined
): { primary: string; isSlug: boolean } {
  if (hasRealName(djName)) return { primary: djName!.trim(), isSlug: false };
  if (slug) return { primary: `/${slug}`, isSlug: true };
  return { primary: "Unnamed DJ", isSlug: false };
}

/** "12 Aug" this year, "12 Aug 2025" otherwise. */
export function joinedLabel(createdAt: string | null | undefined): string {
  if (!createdAt) return "";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** "3 days ago", "Never". Used for last contact. */
export function relativeDays(value: string | null | undefined): string {
  if (!value) return "Never";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "Never";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

/**
 * The best name for a pipeline row.
 *
 * Preference order matters and was wrong at first: a linked DJ whose
 * account still carries the signup default showed as "New DJ" on their
 * task, even though the CRM knows them as "Sol / Graeme Smith". The
 * name a person chose for themselves wins; failing that, the name you
 * recorded during outreach; failing both, the public slug.
 */
export function rowLabel(row: {
  dj?: { dj_name?: string | null; slug?: string | null } | null;
  contact?: { display_name?: string | null } | null;
  name?: string;
}): string {
  if (hasRealName(row.dj?.dj_name)) return row.dj!.dj_name!.trim();
  const recorded = row.contact?.display_name?.trim();
  if (recorded) return recorded;
  if (row.dj?.slug) return `/${row.dj.slug}`;
  return row.name || "Unnamed";
}
