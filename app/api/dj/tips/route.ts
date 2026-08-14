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

    const { data: tips, error: tipsError } = await supabaseAdmin
      .from("tips")
      .select("amount, dj_earnings, message, created_at, status")
      .eq("dj_profile_id", profile.id)
      .eq("status", "succeeded")
      .order("created_at", { ascending: false })
      .limit(50);

    if (tipsError) {
      console.error("Tips load error:", tipsError);

      return NextResponse.json(
        { error: "Unable to load tips." },
        { status: 500 }
      );
    }

    const todayString = new Date().toDateString();

    const todayTotal = (tips ?? [])
      .filter(
        (tip) => new Date(tip.created_at).toDateString() === todayString
      )
      .reduce((total, tip) => total + tip.dj_earnings, 0);

    return NextResponse.json({
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
