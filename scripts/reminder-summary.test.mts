/*
 * The counting rule that keeps the two cohorts apart. Pure: no database,
 * no network. The property under test is that an email whose returns
 * cannot be known is never reported as an email with no returns.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { reminderMeta, summariseReminders } from "../src/lib/lifecycleEmailSummary.ts";
import type { PipelineRow } from "../src/components/admin/crmTypes.ts";

const row = (
  stage: string,
  emails: { tracked: boolean; returned: boolean; status?: string }[]
) =>
  ({
    dj: {
      lifecycle_stage: stage,
      lifecycle_emails: emails.map((e, i) => ({
        template_key: i === 0 ? "recovery_1" : "recovery_2",
        status: e.status ?? "sent",
        attempts: 1,
        created_at: "2026-09-02T20:57:00Z",
        sent_at: "2026-09-02T20:57:00Z",
        last_error_at: null,
        returned_at: e.returned ? "2026-09-03T09:00:00Z" : null,
        return_tracked: e.tracked,
      })),
    },
  }) as unknown as PipelineRow;

test("the untracked cohort never becomes a zero return rate", () => {
  const nine = Array.from({ length: 9 }, () =>
    row("onboarding_incomplete", [{ tracked: false, returned: false }])
  );
  const s = summariseReminders(nine);

  assert.equal(s.untracked.sent, 9);
  assert.equal(s.tracked.sent, 0);
  assert.equal(s.tracked.returned, 0);

  const meta = reminderMeta(s)!;
  assert.equal(meta, "9 sent · returns not measurable");
  assert.ok(!meta.includes("0 came back"), "must never claim zero returns");
});

test("tracked sends produce a real rate, with the earlier cohort kept separate", () => {
  const s = summariseReminders([
    row("onboarding_incomplete", [{ tracked: false, returned: false }]),
    row("onboarding_incomplete", [{ tracked: true, returned: true }]),
    row("ready_to_activate", [{ tracked: true, returned: true }]),
    row("onboarding_incomplete", [{ tracked: true, returned: false }]),
  ]);

  assert.equal(s.tracked.sent, 3);
  assert.equal(s.tracked.returned, 2);
  assert.equal(s.untracked.sent, 1);
  assert.equal(reminderMeta(s), "3 sent · 2 came back · 1 earlier, not measurable");
});

test("conversion counts every emailed DJ, tracked or not", () => {
  const s = summariseReminders([
    row("ready_to_activate", [{ tracked: false, returned: false }]),
    row("activated", [{ tracked: true, returned: false }]),
    row("onboarding_incomplete", [{ tracked: true, returned: true }]),
  ]);

  assert.equal(s.emailed, 3);
  /* activated counts: they reached Ready to activate on the way. */
  assert.equal(s.reachedReady, 2);
});

test("a failed or claimed send is not counted as sent", () => {
  const s = summariseReminders([
    row("onboarding_incomplete", [{ tracked: true, returned: false, status: "failed" }]),
    row("onboarding_incomplete", [{ tracked: true, returned: false, status: "claimed" }]),
  ]);

  assert.equal(s.emailed, 0);
  assert.equal(s.tracked.sent, 0);
  assert.equal(reminderMeta(s), undefined);
});

test("a DJ with no emails is ignored entirely", () => {
  const s = summariseReminders([row("onboarding_incomplete", [])]);
  assert.equal(s.emailed, 0);
  assert.equal(reminderMeta(s), undefined);
});
