import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "@/src/lib/rateLimit";
import { VIP_SLOT_LIMIT } from "@/src/lib/pricing";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

type CreateRequestBody = {
  djSlug?: string;
  songTitle?: string;
  artist?: string;
  requestType?: "song_request" | "song_message";
  message?: string;
  isVip?: boolean;
};

/*
 * Creates a song_requests row server-side, using the service role key.
 * This exists so guests never need direct anon SELECT/INSERT access to
 * song_requests from the browser — that table can hold other guests'
 * private shoutout messages, and RLS can't scope "read only the row
 * whose ID I already know" from "read every row", so the only clean fix
 * is moving reads and writes here instead of loosening a table-wide
 * policy.
 */
export async function POST(request: NextRequest) {
  try {
    const { allowed, retryAfterSeconds } = rateLimit(
      `request-create:${getClientIp(request)}`,
      8,
      60_000
    );

    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: { "Retry-After": retryAfterSeconds.toString() },
        }
      );
    }

    const body = (await request.json()) as CreateRequestBody;

    const djSlug = body.djSlug?.trim().slice(0, 100);
    const songTitle = body.songTitle?.trim().slice(0, 300);
    const artist = body.artist?.trim().slice(0, 300);
    const requestType =
      body.requestType === "song_message" ? "song_message" : "song_request";
    const message = body.message?.trim().slice(0, 500) || null;
    const isVip = body.isVip === true;

    if (!djSlug || !songTitle || !artist) {
      return NextResponse.json(
        { error: "Missing song, artist or DJ." },
        { status: 400 }
      );
    }

    if (requestType === "song_message" && !message) {
      return NextResponse.json(
        { error: "Please add a message for your Song + Message request." },
        { status: 400 }
      );
    }

    const { data: djProfile, error: profileError } = await supabaseAdmin
      .from("dj_profiles")
      .select("id, request_status")
      .eq("slug", djSlug)
      .maybeSingle();

    if (profileError || !djProfile) {
      return NextResponse.json(
        { error: "DJ could not be found." },
        { status: 404 }
      );
    }

    if (djProfile.request_status !== "taking_requests") {
      return NextResponse.json(
        { error: "This DJ is not taking requests right now." },
        { status: 409 }
      );
    }

    if (isVip) {
      const { count: vipCount, error: vipCountError } = await supabaseAdmin
        .from("song_requests")
        .select("id", { count: "exact", head: true })
        .eq("dj_profile_id", djProfile.id)
        .eq("is_vip", true)
        .in("request_status", [
          "checkout_pending",
          "pending",
          "accepted",
          "playing_next",
        ]);

      if (vipCountError) {
        console.error("VIP count error:", vipCountError);

        return NextResponse.json(
          { error: "Unable to create your request." },
          { status: 500 }
        );
      }

      if ((vipCount ?? 0) >= VIP_SLOT_LIMIT) {
        return NextResponse.json(
          { error: "VIP booths are full right now." },
          { status: 409 }
        );
      }
    }

    const { data: existingRequests, error: countError } = await supabaseAdmin
      .from("song_requests")
      .select("id")
      .eq("dj_profile_id", djProfile.id)
      .in("request_status", ["pending", "accepted", "playing_next"]);

    if (countError) {
      console.error("Queue position count error:", countError);

      return NextResponse.json(
        { error: "Unable to create your request." },
        { status: 500 }
      );
    }

    const nextQueuePosition = (existingRequests?.length || 0) + 1;

    const { data, error } = await supabaseAdmin
      .from("song_requests")
      .insert({
        dj_profile_id: djProfile.id,
        song_title: songTitle,
        artist,
        request_status: "checkout_pending",
        queue_position: nextQueuePosition,
        request_type: requestType,
        message: requestType === "song_message" ? message : null,
        is_vip: isVip,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("Request create error:", error);

      return NextResponse.json(
        { error: "Something went wrong creating your request." },
        { status: 500 }
      );
    }

    return NextResponse.json({ requestId: data.id });
  } catch (error) {
    console.error("Request create route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unknown error.",
      },
      { status: 500 }
    );
  }
}
