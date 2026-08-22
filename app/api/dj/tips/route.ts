import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

async function authenticate(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const accessToken = authorization.slice("Bearer ".length).trim();

  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser(accessToken);

  if (error || !user) {
    return null;
  }

  return user;
}

/*
 * tips has RLS enabled with zero policies (deny-all), same as
 * song_requests's underlying design intent — every read goes through a
 * service-role route like this one rather than a direct client query.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json(
        { error: "Your session is invalid or has expired." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("dj_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "DJ profile could not be found." },
        { status: 404 }
      );
    }

    /*
     * No limit, and `id` included.
     *
     * This used to select 50 rows and then compute the day's total from
     * that page, so any DJ past fifty tips would have had their total
     * silently truncated — a financial figure quietly going wrong with
     * nothing on screen to say so. Tip volume per DJ is small enough
     * that reading them all is cheap, and a correct total matters more
     * than a bounded query here.
     */
    const { data: tips, error: tipsError } = await supabaseAdmin
      .from("tips")
      .select("id, amount, dj_earnings, guest_service_fee, platform_fee, message, created_at, status")
      .eq("dj_profile_id", profile.id)
      .eq("status", "succeeded")
      .order("created_at", { ascending: false });

    if (tipsError) {
      console.error("Tips load error:", tipsError);

      return NextResponse.json(
        { error: "Unable to load tips." },
        { status: 500 }
      );
    }

    /*
     * todayTotal is computed here against the SERVER's clock, which on
     * Vercel is UTC — while every page that shows it computes its
     * request earnings against the BROWSER's clock. The dashboard's
     * Tonight strip therefore added a UTC-day tip total to a local-day
     * request total, and just after midnight UK time it showed tonight's
     * requests beside yesterday's tips.
     *
     * It is kept only so existing callers do not break. Both the
     * dashboard and the earnings page now derive their own day totals
     * from `tips` in the viewer's timezone, which is the only clock that
     * matches what a DJ means by "tonight".
     */
    const todayString = new Date().toDateString();

    const todayTotal = (tips ?? [])
      .filter(
        (tip) => new Date(tip.created_at).toDateString() === todayString
      )
      .reduce((total, tip) => total + tip.dj_earnings, 0);

    return NextResponse.json({
      /** @deprecated server-timezone total; compute locally from `tips`. */
      todayTotal,
      tips: tips ?? [],
    });
  } catch (error) {
    console.error("Tips route error:", error);

    return NextResponse.json(
      { error: "Unable to load tips." },
      { status: 500 }
    );
  }
}
