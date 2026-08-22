import {
  FREE_PLATFORM_FEE_BPS,
  PRO_PLATFORM_FEE_BPS,
} from "@/src/lib/pricing";

/*
 * One definition of what a DJ has earned.
 *
 * The page and the CSV both derive from this, so an export cannot
 * disagree with the screen it was exported from — previously the CSV
 * dumped every request including cancelled and expired ones, with their
 * pricing snapshot attached, so a row that never took a penny exported
 * a "Gross Amount" as if it had.
 *
 * Everything below reads stored snapshots. Historical earnings are never
 * recalculated with today's rules: a request accepted while the DJ was
 * on Free keeps its 15% even if they later move to Pro, and older tips
 * that were taken at a different rate keep whatever they actually paid
 * out. `dj_earnings` on the row is the truth.
 */

/** Statuses where the money was captured and belongs to the DJ. */
export const EARNING_STATUSES = ["accepted", "playing_next", "played"] as const;

/*
 * Deliberately not in EARNING_STATUSES.
 *
 * A disputed charge was captured, so the DJ did receive it, and the
 * admin view counts it for exactly that reason. But it is money the
 * cardholder's bank is actively trying to take back, and folding it into
 * a headline "earned" figure means that figure can drop later with no
 * explanation. It gets surfaced on its own instead.
 */
export const AT_RISK_STATUSES = ["disputed"] as const;

/** Captured and then fully returned. Never earnings. */
export const REVERSED_STATUSES = ["refunded"] as const;

export type RequestRow = {
  id: string;
  song_title: string | null;
  artist: string | null;
  request_status: string;
  request_amount: number | null;
  guest_service_fee: number | null;
  platform_fee: number | null;
  dj_earnings: number | null;
  plan_at_checkout: string | null;
  is_vip: boolean | null;
  request_type: string | null;
  created_at: string;
};

export type TipRow = {
  id: string;
  status: string;
  amount: number | null;
  guest_service_fee: number | null;
  platform_fee: number | null;
  dj_earnings: number | null;
  message: string | null;
  created_at: string;
};

const pence = (value: number | null | undefined) => value ?? 0;

const isEarning = (status: string) =>
  (EARNING_STATUSES as readonly string[]).includes(status);

/*
 * "Today" is the browser's local day, matching the dashboard's Tonight
 * strip exactly so the two cannot disagree. Both use toDateString() on
 * the same created_at.
 *
 * Known limitation, deliberately not solved here: a set running past
 * midnight splits across two "days". A real gig-day needs an Events
 * Mode concept that does not exist yet — see ROADMAP.
 */
export const isToday = (iso: string, now = new Date()) =>
  new Date(iso).toDateString() === now.toDateString();

export type EarningsSummary = {
  /** Requests + tips, the honest answer to "what have I earned". */
  totalEarned: number;
  fromRequests: number;
  fromTips: number;
  /** Same basis, limited to the local day. */
  todayTotal: number;
  todayFromRequests: number;
  todayFromTips: number;
  /** What Playing Next kept on earning requests. */
  platformFees: number;
  /** Captured but contested. Excluded from totalEarned. */
  atRisk: number;
  atRiskCount: number;
  /** Captured then fully refunded. Excluded from totalEarned. */
  reversed: number;
  reversedCount: number;
  earningRequestCount: number;
  tipCount: number;
  /*
   * VIP is a count, not an amount, and that is on purpose. request_amount
   * bundles the base price and the VIP uplift together and no column
   * preserves the split, so any monetary VIP figure would be today's
   * VIP_PRICE applied retrospectively to rows that may have been bought
   * at a different one. A number we cannot prove is worse than a count
   * that is simply true.
   */
  vipRequestCount: number;
  freeRequestCount: number;
  proRequestCount: number;
};

export function summariseEarnings(
  requests: RequestRow[],
  tips: TipRow[],
  now = new Date()
): EarningsSummary {
  const earning = requests.filter((r) => isEarning(r.request_status));
  const succeededTips = tips.filter((t) => t.status === "succeeded");

  const atRiskRows = requests.filter((r) =>
    (AT_RISK_STATUSES as readonly string[]).includes(r.request_status)
  );
  const reversedRows = requests.filter((r) =>
    (REVERSED_STATUSES as readonly string[]).includes(r.request_status)
  );

  const sum = <T,>(rows: T[], pick: (row: T) => number | null | undefined) =>
    rows.reduce((total, row) => total + pence(pick(row)), 0);

  const fromRequests = sum(earning, (r) => r.dj_earnings);
  const fromTips = sum(succeededTips, (t) => t.dj_earnings);

  const todayRequests = earning.filter((r) => isToday(r.created_at, now));
  const todayTips = succeededTips.filter((t) => isToday(t.created_at, now));

  return {
    totalEarned: fromRequests + fromTips,
    fromRequests,
    fromTips,
    todayFromRequests: sum(todayRequests, (r) => r.dj_earnings),
    todayFromTips: sum(todayTips, (t) => t.dj_earnings),
    todayTotal:
      sum(todayRequests, (r) => r.dj_earnings) +
      sum(todayTips, (t) => t.dj_earnings),
    platformFees: sum(earning, (r) => r.platform_fee),
    atRisk: sum(atRiskRows, (r) => r.dj_earnings),
    atRiskCount: atRiskRows.length,
    reversed: sum(reversedRows, (r) => r.dj_earnings),
    reversedCount: reversedRows.length,
    earningRequestCount: earning.length,
    tipCount: succeededTips.length,
    vipRequestCount: earning.filter((r) => r.is_vip).length,
    freeRequestCount: earning.filter((r) => r.plan_at_checkout !== "pro").length,
    proRequestCount: earning.filter((r) => r.plan_at_checkout === "pro").length,
  };
}

/** Percentages read from pricing.ts rather than typed into the page. */
export const FREE_FEE_PERCENT = FREE_PLATFORM_FEE_BPS / 100;
export const PRO_FEE_PERCENT = PRO_PLATFORM_FEE_BPS / 100;

/*
 * ── Transactions ─────────────────────────────────────────────────────
 * Requests and tips in one ordered list. A tip is its own kind of row,
 * never attached to a request: the schema has no link between them and
 * inventing one in the UI would be a claim the data cannot support.
 */
export type Transaction = {
  id: string;
  kind: "request" | "tip";
  title: string;
  subtitle: string | null;
  status: string;
  createdAt: string;
  /** Only set where the row genuinely represents money the DJ earned. */
  earned: number | null;
  isVip: boolean;
};

export function buildTransactions(
  requests: RequestRow[],
  tips: TipRow[]
): Transaction[] {
  const rows: Transaction[] = [
    ...requests.map((r) => ({
      id: r.id,
      kind: "request" as const,
      title: r.song_title || "Untitled",
      subtitle: r.artist,
      status: r.request_status,
      createdAt: r.created_at,
      /*
       * null, not zero, for anything that did not capture. A cancelled
       * or expired request still carries a pricing snapshot, and showing
       * that snapshot next to real earnings made money that never
       * existed look like income.
       */
      earned: isEarning(r.request_status) ? pence(r.dj_earnings) : null,
      isVip: r.is_vip === true,
    })),
    ...tips.map((t) => ({
      id: t.id,
      kind: "tip" as const,
      title: "Tip",
      subtitle: t.message,
      status: t.status,
      createdAt: t.created_at,
      earned: t.status === "succeeded" ? pence(t.dj_earnings) : null,
      isVip: false,
    })),
  ];

  return rows.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/*
 * ── CSV ──────────────────────────────────────────────────────────────
 *
 * Built from the same Transaction list the page renders, so the export
 * and the screen cannot disagree. The old export pulled raw request rows
 * separately, included cancelled/declined/expired with their gross
 * amounts, omitted tips entirely, and stamped dates in UTC while the
 * page grouped by local day — so a 00:30 transaction could land on a
 * different date in the file than on the screen.
 *
 * "Earned (£)" is blank rather than 0.00 for non-earning rows. A zero
 * reads as "earned nothing on this"; blank reads as "this is not an
 * earning" — and it keeps a spreadsheet SUM over the column equal to the
 * page's total.
 */
const csvCell = (value: string | number) =>
  `"${String(value).replace(/"/g, '""')}"`;

export function buildEarningsCsv(transactions: Transaction[]): string {
  const header = [
    "Date",
    "Time",
    "Type",
    "Title",
    "Artist / Message",
    "Status",
    "VIP",
    "Earned (£)",
  ];

  const rows = transactions.map((t) => {
    const when = new Date(t.createdAt);
    return [
      /* Local, matching how the page groups and displays. */
      when.toLocaleDateString("en-GB"),
      when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      t.kind === "tip" ? "Tip" : "Song request",
      t.title,
      t.subtitle ?? "",
      t.status,
      t.isVip ? "Yes" : "",
      t.earned === null ? "" : (t.earned / 100).toFixed(2),
    ];
  });

  return [header, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
}

/** Sum of the CSV's Earned column — used to assert it matches the page. */
export function csvEarnedTotal(transactions: Transaction[]): number {
  return transactions.reduce((total, t) => total + (t.earned ?? 0), 0);
}
