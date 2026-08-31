/*
 * ── Retention: one classification, three rules, no side effects ───
 *
 * Every function here is pure. Nothing in this module reads or writes a
 * database; callers pass rows in and get a plan back. That is what makes
 * the report-only mode honest rather than a promise - there is no code
 * path from here to a mutation, because there is no I/O here at all.
 *
 * The destructive executor does not exist yet. When it does, it consumes
 * this plan and must call assertRetentionExecutionEnabled() first.
 */

/*
 * ── Why the classification is shaped like this ────────────────────
 *
 * Measured against Production on 2026-08-31, and the measurements are
 * the reason for every guard:
 *
 *   stripe_fee is written CONDITIONALLY on capture. See
 *   app/api/stripe/capture/route.ts - when Stripe returns no balance
 *   transaction the code logs an error and still marks the row accepted.
 *   51 of 65 played rows carry no fee. A missing fee therefore proves
 *   nothing at all.
 *
 *   The money columns are written at CHECKOUT CREATION, not at capture.
 *   Production holds expired, declined and cancelled rows carrying a
 *   total_amount. An amount is an intent to charge, not a charge.
 *
 *   A CheckoutSession can complete up to 24 hours after it is created,
 *   which is the checkout_pending case behind the standing rule that a
 *   row is never removed while its Stripe state is unverified.
 *
 * So no single field is treated as proof. "Never charged" is a
 * conjunction of every absence we can establish, and anything short of
 * that conjunction is Unknown.
 */
export type PaymentClass = "preserve" | "never_charged" | "unknown";

export const CLASS_LABELS: Record<PaymentClass, string> = {
  preserve: "Financial record",
  never_charged: "Never charged",
  unknown: "Unverified",
};

/** The columns classification reads. Nothing else is consulted. */
export type ClassifiableRequest = {
  id: string;
  request_status: string;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_fee: number | null;
  reported_not_played_at: string | null;
};

export type ClassifiableTip = {
  id: string;
  status: string;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_fee: number | null;
};

/*
 * Statuses that mean money was taken and settled one way or another. A
 * refund does not un-take a payment and a dispute is live evidence, so
 * both preserve the row rather than releasing it.
 */
const SETTLED_MONEY_REQUEST = new Set(["refunded", "disputed"]);
const SETTLED_MONEY_TIP = new Set(["succeeded", "refunded", "disputed"]);

/*
 * The only statuses from which a row may ever be released, and only then
 * in conjunction with every absence below. "played" is deliberately
 * absent: it is an accepted-family status, so money moved even on the 51
 * rows where the fee is missing.
 */
const TERMINAL_UNPAID_REQUEST = new Set([
  "expired",
  "cancelled",
  "declined",
  "archived",
]);
const TERMINAL_UNPAID_TIP = new Set(["expired", "cancelled"]);

export function classifyRequest(
  row: ClassifiableRequest,
  /** Ids that a not_played_reports row points at. */
  reportedRequestIds: ReadonlySet<string>
): PaymentClass {
  if (row.stripe_fee !== null && row.stripe_fee !== undefined) return "preserve";
  if (SETTLED_MONEY_REQUEST.has(row.request_status)) return "preserve";

  /* An open or closed refund conversation is evidence about money. */
  if (row.reported_not_played_at) return "unknown";
  if (reportedRequestIds.has(row.id)) return "unknown";

  const neverCharged =
    row.stripe_payment_intent_id === null &&
    row.stripe_checkout_session_id === null &&
    TERMINAL_UNPAID_REQUEST.has(row.request_status);

  return neverCharged ? "never_charged" : "unknown";
}

export function classifyTip(row: ClassifiableTip): PaymentClass {
  if (row.stripe_fee !== null && row.stripe_fee !== undefined) return "preserve";
  if (SETTLED_MONEY_TIP.has(row.status)) return "preserve";

  const neverCharged =
    row.stripe_payment_intent_id === null &&
    row.stripe_checkout_session_id === null &&
    TERMINAL_UNPAID_TIP.has(row.status);

  return neverCharged ? "never_charged" : "unknown";
}

/* ── The rules ─────────────────────────────────────────────────── */

export const MESSAGE_RETENTION_DAYS = 90;
export const NEVER_CHARGED_DELETION_DAYS = 365;

/*
 * There is deliberately no financial retention period in this file. That
 * decision is open pending accounting and legal advice and the company
 * structure it depends on, and inventing a constant for it would make a
 * guess look like a policy. Class "preserve" rows are simply never
 * deleted by anything here.
 */

const DAY_MS = 86_400_000;

function ageInDays(iso: string, now: number): number {
  return (now - new Date(iso).getTime()) / DAY_MS;
}

export type RuleId = "R1" | "R2" | "R3" | "R4";

export const RULE_LABELS: Record<RuleId, string> = {
  R1: "Clear request messages",
  R2: "Clear tip messages",
  R3: "Clear resolved report reasons",
  R4: "Delete never-charged rows",
};

export const RULE_DESCRIPTIONS: Record<RuleId, string> = {
  R1: `Guest message cleared ${MESSAGE_RETENTION_DAYS} days after the request was created. Runs on every class; money is never touched.`,
  R2: `Tip message cleared ${MESSAGE_RETENTION_DAYS} days after the tip was created. Runs on every class; money is never touched.`,
  R3: `Report reason cleared ${MESSAGE_RETENTION_DAYS} days after the report, and only once its resolution is final. The report row itself is kept.`,
  R4: `Row deleted ${NEVER_CHARGED_DELETION_DAYS} days after creation, and only where every never-charged condition is positively established.`,
};

export type PlannedAction = {
  rule: RuleId;
  objectType: "song_request" | "tip" | "not_played_report";
  objectId: string;
  classification: PaymentClass;
  /** Field names only. Never their contents - see data_erasures. */
  fieldsCleared: string[];
  rowDeleted: boolean;
  ageDays: number;
};

export type RetentionPlan = {
  generatedAt: string;
  actions: PlannedAction[];
  counts: Record<RuleId, number>;
  /** Rows carrying personal data that no rule touches yet, and why. */
  notYetDue: { objectType: string; objectId: string; daysUntilDue: number }[];
  /** Class C rows: reported so they are visible, never acted on. */
  unverified: { objectType: string; objectId: string; status: string }[];
  classCounts: Record<PaymentClass, number>;
};

export type RetentionInput = {
  requests: (ClassifiableRequest & { message: string | null; created_at: string })[];
  tips: (ClassifiableTip & { message: string | null; created_at: string })[];
  reports: {
    id: string;
    reason: string | null;
    resolution: string;
    created_at: string;
  }[];
  reportedRequestIds: ReadonlySet<string>;
};

/**
 * What the rules WOULD do. Computes only; the caller decides whether
 * anything is ever executed, and today nothing can be.
 */
export function buildRetentionPlan(
  input: RetentionInput,
  now: number = Date.now()
): RetentionPlan {
  const actions: PlannedAction[] = [];
  const notYetDue: RetentionPlan["notYetDue"] = [];
  const unverified: RetentionPlan["unverified"] = [];
  const classCounts: Record<PaymentClass, number> = {
    preserve: 0,
    never_charged: 0,
    unknown: 0,
  };

  const hasText = (v: string | null) => !!v && v.trim().length > 0;

  for (const row of input.requests) {
    const cls = classifyRequest(row, input.reportedRequestIds);
    classCounts[cls] += 1;
    const age = ageInDays(row.created_at, now);

    if (hasText(row.message)) {
      if (age >= MESSAGE_RETENTION_DAYS) {
        actions.push({
          rule: "R1",
          objectType: "song_request",
          objectId: row.id,
          classification: cls,
          fieldsCleared: ["message"],
          rowDeleted: false,
          ageDays: Math.floor(age),
        });
      } else {
        notYetDue.push({
          objectType: "song_request",
          objectId: row.id,
          daysUntilDue: Math.ceil(MESSAGE_RETENTION_DAYS - age),
        });
      }
    }

    if (cls === "never_charged" && age >= NEVER_CHARGED_DELETION_DAYS) {
      actions.push({
        rule: "R4",
        objectType: "song_request",
        objectId: row.id,
        classification: cls,
        fieldsCleared: [],
        rowDeleted: true,
        ageDays: Math.floor(age),
      });
    }

    if (cls === "unknown") {
      unverified.push({
        objectType: "song_request",
        objectId: row.id,
        status: row.request_status,
      });
    }
  }

  for (const row of input.tips) {
    const cls = classifyTip(row);
    classCounts[cls] += 1;
    const age = ageInDays(row.created_at, now);

    if (hasText(row.message)) {
      if (age >= MESSAGE_RETENTION_DAYS) {
        actions.push({
          rule: "R2",
          objectType: "tip",
          objectId: row.id,
          classification: cls,
          fieldsCleared: ["message"],
          rowDeleted: false,
          ageDays: Math.floor(age),
        });
      } else {
        notYetDue.push({
          objectType: "tip",
          objectId: row.id,
          daysUntilDue: Math.ceil(MESSAGE_RETENTION_DAYS - age),
        });
      }
    }

    if (cls === "never_charged" && age >= NEVER_CHARGED_DELETION_DAYS) {
      actions.push({
        rule: "R4",
        objectType: "tip",
        objectId: row.id,
        classification: cls,
        fieldsCleared: [],
        rowDeleted: true,
        ageDays: Math.floor(age),
      });
    }

    if (cls === "unknown") {
      unverified.push({ objectType: "tip", objectId: row.id, status: row.status });
    }
  }

  for (const row of input.reports) {
    if (!hasText(row.reason)) continue;
    const age = ageInDays(row.created_at, now);

    /* Final means decided. A pending report still needs its evidence. */
    const final = row.resolution !== "pending";

    if (final && age >= MESSAGE_RETENTION_DAYS) {
      actions.push({
        rule: "R3",
        objectType: "not_played_report",
        objectId: row.id,
        /* The report row itself is preserved; only the free text goes. */
        classification: "preserve",
        fieldsCleared: ["reason"],
        rowDeleted: false,
        ageDays: Math.floor(age),
      });
    } else {
      notYetDue.push({
        objectType: "not_played_report",
        objectId: row.id,
        daysUntilDue: final ? Math.ceil(MESSAGE_RETENTION_DAYS - age) : -1,
      });
    }
  }

  const counts: Record<RuleId, number> = { R1: 0, R2: 0, R3: 0, R4: 0 };
  for (const a of actions) counts[a.rule] += 1;

  return {
    generatedAt: new Date(now).toISOString(),
    actions,
    counts,
    notYetDue,
    unverified,
    classCounts,
  };
}
