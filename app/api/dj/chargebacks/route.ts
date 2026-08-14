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
 * chargeback_disputes has RLS enabled with zero policies (deny-all),
 * same as tips and song_requests — every read goes through a
 * service-role route like this one.
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

    const { data: disputes, error: disputesError } = await supabaseAdmin
      .from("chargeback_disputes")
      .select(
        "id, description, disputed_amount, dj_response, deduction_status, respond_by, created_at"
      )
      .eq("dj_profile_id", profile.id)
      .eq("dj_response", "pending")
      .eq("deduction_status", "pending")
      .order("created_at", { ascending: false });

    if (disputesError) {
      console.error("Chargebacks load error:", disputesError);

      return NextResponse.json(
        { error: "Unable to load disputes." },
        { status: 500 }
      );
    }

    return NextResponse.json({ disputes: disputes ?? [] });
  } catch (error) {
    console.error("Chargebacks route error:", error);

    return NextResponse.json(
      { error: "Unable to load disputes." },
      { status: 500 }
    );
  }
}
