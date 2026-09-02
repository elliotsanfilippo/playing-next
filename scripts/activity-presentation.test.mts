/*
 * What the contact timeline shows, and what it refuses to show.
 * Pure: no database, no network.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { buildActivity } from "../src/lib/crmActivity.ts";
import type { PipelineRow } from "../src/components/admin/crmTypes.ts";

const row = (dj: Record<string, unknown>) =>
  ({
    dj: {
      created_at: "2026-08-24T10:00:00Z",
      onboarding_complete: false,
      stripe_connected: false,
      plan: "free",
      profile_completed_at: null,
      onboarded_at: null,
      payments_ready_at: null,
      pro_since: null,
      first_request_at: null,
      first_paid_at: null,
      repeat_night_at: null,
      lifecycle_emails: [],
      ...dj,
    },
  }) as unknown as PipelineRow;

const titles = (r: PipelineRow) => buildActivity(r, [], []).map((e) => e.title);

test("a dated profile completion appears at its real time", () => {
  const entries = buildActivity(
    row({ profile_completed_at: "2026-09-12T14:00:00Z" }),
    [],
    []
  );
  const entry = entries.find((e) => e.title === "Profile completed");

  assert.ok(entry, "should appear");
  assert.equal(entry!.at, "2026-09-12T14:00:00Z");
});

test("an undated profile completion is omitted entirely, not shown as undated", () => {
  /* The five profiles that were already complete before the column
     existed. Their state says they are complete; the timeline does not
     pretend to know when. */
  const complete = row({
    profile_completed_at: null,
    onboarding_complete: true,
    stripe_connected: true,
  });

  assert.ok(!titles(complete).includes("Profile completed"));
});

test("the other undated product events still render, because they say something true", () => {
  /* Contrast: these keep the "before tracking began" treatment, which is
     why Profile completed had to be handled separately rather than by
     changing the shared rule. */
  const t = titles(row({ onboarding_complete: true, stripe_connected: true }));

  assert.ok(t.includes("Ready to activate"));
  assert.ok(t.includes("Payouts connected"));
});

test("labels are the human ones, never the internal funnel language", () => {
  const t = titles(row({ onboarding_complete: true, stripe_connected: true }));

  assert.ok(!t.includes("Finished onboarding"), "that named our funnel, not their position");
  assert.ok(!t.includes("Connected payments"));
  assert.ok(t.includes("Ready to activate"));
});

const email = (over: Record<string, unknown> = {}) => ({
  template_key: "recovery_1",
  state_at_send: "A",
  status: "sent",
  attempts: 1,
  created_at: "2026-09-02T20:57:00Z",
  sent_at: "2026-09-02T20:57:45Z",
  last_error_at: null,
  returned_at: null,
  return_tracked: true,
  subject_at_send: "Two steps from your first paid request",
  delivery_state: null,
  delivery_state_at: null,
  ...over,
});

const emailEntry = (over: Record<string, unknown> = {}) =>
  buildActivity(row({ lifecycle_emails: [email(over)] }), [], []).find((e) => e.kind === "email")!;

test("an email is one item, not three", () => {
  const entries = buildActivity(
    row({ lifecycle_emails: [email({ delivery_state: "delivered", delivery_state_at: "2026-09-02T20:57:47Z", returned_at: "2026-09-03T09:12:00Z" })] }),
    [],
    []
  );
  assert.equal(entries.filter((e) => e.kind === "email").length, 1);
});

test("recovery_1 and recovery_2 are named for people", () => {
  assert.equal(emailEntry().title, "Setup email sent");
  assert.equal(emailEntry({ template_key: "recovery_2" }).title, "Setup follow-up sent");
});

test("the stored state letter becomes human language", () => {
  assert.equal(emailEntry({ state_at_send: "A" }).email!.stateLabel, "Profile + payouts incomplete");
  assert.equal(emailEntry({ state_at_send: "B" }).email!.stateLabel, "Payouts incomplete");
  assert.equal(emailEntry({ state_at_send: "C" }).email!.stateLabel, "Profile incomplete");
});

test("the historical subject is shown, not a rebuilt one", () => {
  assert.equal(
    emailEntry({ subject_at_send: "Your Playing Next page cannot take payment yet" }).email!.subject,
    "Your Playing Next page cannot take payment yet"
  );
});

test("a delivered state with no time renders as a label with no clock", () => {
  const stamps = emailEntry({ delivery_state: "delivered", delivery_state_at: null }).email!.stamps;
  const delivered = stamps.find((s) => s.label === "Delivered")!;
  assert.ok(delivered, "should be present");
  assert.equal(delivered.at, null, "and carry no invented time");
});

test("unknown facts produce no stamp at all", () => {
  const stamps = emailEntry().email!.stamps;
  assert.deepEqual(stamps.map((s) => s.label), ["Sent"]);
  assert.ok(!stamps.some((s) => s.label.startsWith("Returned")), "never an empty Returned");
});

test("all three stamps appear once everything is known", () => {
  const stamps = emailEntry({
    delivery_state: "delivered",
    delivery_state_at: "2026-09-02T20:57:47Z",
    returned_at: "2026-09-03T09:12:00Z",
  }).email!.stamps;

  assert.deepEqual(stamps.map((s) => s.label), ["Sent", "Delivered", "Returned to Playing Next"]);
  assert.ok(stamps.every((s) => s.at), "each carries its real time");
});

test("an untracked email says so, and never implies zero returns", () => {
  const e = emailEntry({ return_tracked: false, delivery_state: "delivered" }).email!;
  assert.equal(e.note, "Return tracking was not in place for this email");
  assert.ok(!e.stamps.some((s) => s.label.startsWith("Returned")));
});

test("no internal identifier reaches a timeline title or subtext", () => {
  const entries = buildActivity(
    row({
      profile_completed_at: "2026-09-12T14:00:00Z",
      onboarding_complete: true,
      stripe_connected: true,
      lifecycle_emails: [
        email({ delivery_state: "delivered", delivery_state_at: "2026-09-02T20:57:47Z", returned_at: "2026-09-03T09:12:00Z" }),
      ],
    }),
    [],
    []
  );

  const text = entries
    .map((e) => [e.title, e.detail, e.email?.subject, e.email?.stateLabel, e.email?.note,
                 ...(e.email?.stamps ?? []).map((s) => s.label)].filter(Boolean).join(" "))
    .join(" | ");

  for (const internal of ["recovery_1", "recovery_2", "state_at_send"]) {
    assert.ok(!text.includes(internal), `${internal} must never be shown`);
  }
  /* A, B and C as bare state letters must not appear as labels either. */
  assert.ok(!/\bstate [ABC]\b/i.test(text));

  assert.ok(text.includes("Setup email sent"));
  assert.ok(text.includes("Returned to Playing Next"));
});
