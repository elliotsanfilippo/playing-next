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
