import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "@/src/lib/rateLimit";

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

function slugify(email: string) {
  return email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/*
 * Creates the dj_profiles row for a freshly-signed-up user. Runs with
 * the service role because right after supabase.auth.signUp() (with
 * email confirmation on) there's no session yet, so the client-side
 * anon-key insert used to fail RLS every time. Also doubles as a
 * self-heal for the handful of accounts that already got stuck in
 * that state before this existed.
 *
 * Two ways to identify the user: a bearer token (already-logged-in
 * self-heal path) or a userId/email pair validated against
 * auth.admin.getUserById (the immediately-post-signup path, where no
 * session exists yet).
 */
export async function POST(request: NextRequest) {
  try {
    const { allowed, retryAfterSeconds } = rateLimit(
      `bootstrap-profile:${getClientIp(request)}`,
      10,
      60_000
    );

    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers: { "Retry-After": retryAfterSeconds.toString() } }
      );
    }

    const authorization = request.headers.get("authorization");
    let userId: string;
    let email: string;

    if (authorization?.startsWith("Bearer ")) {
      const accessToken = authorization.slice("Bearer ".length).trim();
      const {
        data: { user },
        error,
      } = await supabaseAuth.auth.getUser(accessToken);

      if (error || !user || !user.email) {
        return NextResponse.json(
          { error: "Your session is invalid or has expired." },
          { status: 401 }
        );
      }

      userId = user.id;
      email = user.email;
    } else {
      const body = await request.json();

      if (!body.userId || !body.email) {
        return NextResponse.json(
          { error: "Missing userId or email." },
          { status: 400 }
        );
      }

      const { data: userData, error: userError } =
        await supabaseAdmin.auth.admin.getUserById(body.userId);

      if (userError || !userData?.user || userData.user.email !== body.email) {
        return NextResponse.json({ error: "Invalid account." }, { status: 403 });
      }

      userId = body.userId;
      email = body.email;
    }

    const { data: existingProfile } = await supabaseAdmin
      .from("dj_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json({ ok: true, created: false });
    }

    const { error: insertError } = await supabaseAdmin.from("dj_profiles").insert({
      user_id: userId,
      dj_name: "New DJ",
      slug: slugify(email),
      bio: "",
      genres: [],
      request_price: 500,
      shoutout_price: 800,
      request_status: "taking_requests",
    });

    if (insertError) {
      console.error("Bootstrap profile insert failed:", insertError);

      return NextResponse.json(
        { error: "Unable to set up your DJ profile." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, created: true });
  } catch (error) {
    /* Detail stays server-side. The caller gets a fixed sentence. */
    console.error("Bootstrap profile route error:", error);

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
