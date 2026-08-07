export type SongRequest = {
  id: string;
  song_title: string;
  artist: string;
  message: string | null;
  request_type: string | null;
  request_status: string;
  stripe_payment_intent_id: string | null;
  queue_position: number | null;
};

export type DJProfile = {
  id: string;
  dj_name: string;
  slug: string;
  request_status: string;
  profile_image_url: string | null;
  request_price?: number | null;
  stripe_connected?: boolean;
  plan?: string;
  onboarding_complete: boolean;
launch_complete_seen: boolean;
};