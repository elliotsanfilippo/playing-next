export type SongRequest = {
  id: string;
  song_title: string;
  artist: string;
  message: string | null;
  request_type: string | null;
  request_status: string;
  stripe_payment_intent_id: string | null;
  queue_position: number | null;
  created_at: string;
  dj_earnings: number | null;
  is_vip: boolean;
};

export type DJProfile = {
  id: string;
  dj_name: string;
  slug: string;
  request_status: string;
  profile_image_url: string | null;
  genres?: string[] | string | null;
  request_price?: number | null;
  shoutout_price?: number | null;
  stripe_connected?: boolean;
  plan?: string;
  stripe_subscription_status?: string | null;
  auto_close_at?: string | null;
  session_started_at?: string | null;
  onboarding_complete: boolean;
  launch_complete_seen: boolean;
  qr_box_eligible?: boolean;
  qr_box_claimed?: boolean;
  qr_box_dismissed?: boolean;
};
