import type { LifecycleStage } from "@/src/lib/djLifecycle";

/** A DJ account as the admin API reports it, lifecycle already derived. */
export type DjStat = {
  id: string;
  dj_name: string;
  slug: string;
  plan: string | null;
  request_status: string;
  created_at: string;
  accepted_ever: number;
  played: number;
  not_played_reports: number;
  dispute_rate: number;
  net_earnings: number;
  missing_earnings_count: number;
  lifecycle_stage: LifecycleStage;
  paid_accepted_count: number;
  gig_date_count: number;
  onboarding_complete: boolean;
  stripe_connected: boolean;
  /* Product events for the timeline. The three *_at / pro_since values
     are NULL for DJs who reached that state before the columns existed. */
  first_request_at: string | null;
  first_paid_at: string | null;
  repeat_night_at: string | null;
  /* Null means "complete, but before tracking began" as often as it
     means "not complete". The lifecycle stage says which, and the
     timeline omits the event rather than dating it. */
  profile_completed_at: string | null;
  onboarded_at: string | null;
  payments_ready_at: string | null;
  pro_since: string | null;
  /* Delivery history for lifecycle email. Never a lifecycle input. */
  lifecycle_emails: LifecycleEmailRecord[];
};

/** One row of dj_lifecycle_emails, as the admin API reports it. */
export type LifecycleEmailRecord = {
  template_key: "recovery_1" | "recovery_2";
  status: "claimed" | "sent" | "failed";
  attempts: number;
  created_at: string;
  sent_at: string | null;
  last_error_at: string | null;
  /* First time the DJ came back from this email's CTA. Null means either
     "has not come back" or "cannot be known" - return_tracked says
     which, and the two must never be added together. */
  returned_at: string | null;
  return_tracked: boolean;
};

export type CrmContact = {
  id: string;
  display_name: string;
  contact_channel: string | null;
  contact_handle: string | null;
  acquisition_source: string | null;
  outreach_status: string;
  activation_blocker: string | null;
  next_gig_date: string | null;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  next_action: string | null;
  dj_profile_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmNote = {
  id: string;
  contact_id: string;
  body: string;
  occurred_at: string;
  created_at: string;
};

export type Report = {
  id: string;
  reason: string | null;
  resolution: "pending" | "refunded" | "denied";
  created_at: string;
  resolved_at: string | null;
  song_requests: { song_title: string; artist: string } | null;
  dj_profiles: { dj_name: string; slug: string } | null;
};

/*
 * One row of the pipeline.
 *
 * The list is deliberately a union of two different things: DJs who have
 * an account, and prospects who do not. A prospect has no dj_profiles
 * row at all, which is the case the database could not represent before
 * crm_contacts existed and the whole reason it does.
 *
 * `dj` is null for an unlinked prospect. `contact` is null for a DJ who
 * signed up without ever being in the outreach pipeline, which is most
 * of them today.
 */
export type PipelineRow = {
  key: string;
  name: string;
  dj: DjStat | null;
  contact: CrmContact | null;
  stage: LifecycleStage;
};

/** A DJ account no CRM contact has claimed yet, for the linking UI. */
export type UnlinkedDj = {
  id: string;
  dj_name: string;
  slug: string;
  created_at: string;
};

/*
 * A CRM prospect with no account yet, as offered to a new signup that
 * might be the same person. The counts say what linking will carry
 * across, which is the whole reason the picker shows more than a name.
 */
export type UnlinkedContact = {
  id: string;
  display_name: string;
  outreach_status: string;
  contact_channel: string | null;
  contact_handle: string | null;
  activation_blocker: string | null;
  last_contact_at: string | null;
  created_at: string;
  note_count: number;
  open_task_count: number;
};

/*
 * A thing the admin has to do. Open when completed_at is null; the row
 * survives completion so the timeline can show it.
 */
export type CrmTask = {
  id: string;
  contact_id: string;
  title: string;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
