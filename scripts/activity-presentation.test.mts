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

test("no internal identifier reaches a timeline title", () => {
  const entries = buildActivity(
    row({
      profile_completed_at: "2026-09-12T14:00:00Z",
      onboarding_complete: true,
      stripe_connected: true,
      lifecycle_emails: [
        {
          template_key: "recovery_1",
          status: "sent",
          attempts: 1,
          created_at: "2026-09-02T20:57:00Z",
          sent_at: "2026-09-02T20:57:00Z",
          last_error_at: null,
          returned_at: "2026-09-03T09:00:00Z",
          return_tracked: true,
        },
      ],
    }),
    [],
    []
  );

  const text = entries.map((e) => `${e.title} ${e.detail ?? ""}`).join(" | ");

  for (const internal of ["recovery_1", "recovery_2"]) {
    assert.ok(!text.includes(internal), `${internal} must never be shown`);
  }
  assert.ok(text.includes("Setup reminder sent"));
  assert.ok(text.includes("Came back from the setup reminder"));
});
