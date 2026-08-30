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

/*
 * ── The one human-facing identity in PN Admin ─────────────────────
 *
 * Three sources, in this order:
 *
 *   1. the DJ's own name, unless it is the "New DJ" signup default
 *   2. the name recorded during outreach, on the CRM contact
 *   3. the public slug
 *
 * The middle step is the whole point, and its absence was a real bug.
 * There used to be two helpers: this one, which went straight from the
 * DJ name to the slug, and rowLabel, which checked the contact in
 * between. So Sol read as "/smithgraeme91" in Contacts and as
 * "Sol / Graeme Smith" on their own task, and nothing on either screen
 * said they were the same person. A name you have written down about
 * somebody is better than their URL; skipping it was never a decision,
 * just two code paths.
 *
 * rowLabel is now this function's primary, so there is one answer.
 * displayIdentity remains for the callers that genuinely hold only a DJ
 * and no contact - the link pickers offer accounts nobody has claimed,
 * where step 2 has nothing to read by definition.
 */
export function rowIdentity(row: {
  dj?: { dj_name?: string | null; slug?: string | null } | null;
  contact?: { display_name?: string | null } | null;
  name?: string;
}): { primary: string; isSlug: boolean } {
  if (hasRealName(row.dj?.dj_name)) {
    return { primary: row.dj!.dj_name!.trim(), isSlug: false };
  }

  const recorded = row.contact?.display_name?.trim();
  if (recorded) return { primary: recorded, isSlug: false };

  /* A prospect with no account has its name on the row itself. */
  if (!row.dj && row.name?.trim()) {
    return { primary: row.name.trim(), isSlug: false };
  }

  if (row.dj?.slug) return { primary: `/${row.dj.slug}`, isSlug: true };
  return { primary: row.name?.trim() || "Unnamed DJ", isSlug: false };
}

/**
 * Sort key for A-Z ordering by the identity on screen.
 *
 * The leading slash is dropped rather than sorted on. Seven accounts
 * show as "/bookings" or "/jojo-metayer" because their DJ never set a
 * name, and sorting the raw string would herd every one of them above
 * the letter A - an alphabetical list whose first section is not
 * alphabetical at all. Dropping it files /bookings under B, which is
 * where somebody looking for it would run their thumb.
 *
 * localeCompare with base sensitivity so case and accents do not open a
 * second alphabet, and numeric so a DJ called "DJ 100" sorts after
 * "DJ 9".
 */
export function identitySortKey(row: {
  dj?: { dj_name?: string | null; slug?: string | null } | null;
  name?: string;
}): string {
  return rowIdentity(row).primary.replace(/^\//, "");
}

export function compareByIdentity(
  a: Parameters<typeof identitySortKey>[0],
  b: Parameters<typeof identitySortKey>[0]
): number {
  return identitySortKey(a).localeCompare(identitySortKey(b), undefined, {
    sensitivity: "base",
    numeric: true,
  });
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
 * The best name for a pipeline row, as a bare string.
 *
 * Kept as its own export because most callers want text rather than the
 * isSlug flag - a task's subtitle, a search result label. It is
 * rowIdentity's answer verbatim, so the two can no longer differ.
 */
export function rowLabel(row: Parameters<typeof rowIdentity>[0]): string {
  return rowIdentity(row).primary;
}
