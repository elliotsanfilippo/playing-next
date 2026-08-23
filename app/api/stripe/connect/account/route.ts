import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import {
  CONNECT_SELECT,
  connectColumns,
  resolveConnectAccount,
  stripeMode,
} from "@/src/lib/stripeEnvironment";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json(
        { error: "Your session is invalid or has expired." },
        { status: 401 }
      );
    }

    const { data: djProfile, error: profileError } = await supabaseAdmin
      .from("dj_profiles")
      .select(`id, dj_name, ${CONNECT_SELECT}`)
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("DJ profile lookup failed:", profileError);

      return NextResponse.json(
        { error: "Unable to load your DJ profile." },
        { status: 500 }
      );
    }

    if (!djProfile) {
      return NextResponse.json(
        { error: "No DJ profile was found." },
        { status: 404 }
      );
    }

    const existing = resolveConnectAccount(djProfile);

    if (existing.accountId) {
      return NextResponse.json({
        accountId: existing.accountId,
        created: false,
        mode: existing.mode,
      });
    }

    const account = await stripe.accounts.create(
      {
        country: "GB",
        email: user.email ?? undefined,

        business_profile: {
          name: djProfile.dj_name,
          product_description:
            "Song request payments received through Playing Next.",
        },

        controller: {
          stripe_dashboard: {
            type: "express",
          },
          fees: {
            payer: "application",
          },
          losses: {
            payments: "application",
          },
        },

        capabilities: {
          transfers: {
            requested: true,
          },
        },

        /*
         * Manual payout schedule — DJs withdraw on their own terms via the
         * earnings page rather than having Stripe sweep their balance out
         * automatically on its own timing.
         */
        settings: {
          payouts: {
            schedule: {
              interval: "manual",
            },
          },
        },

        metadata: {
          supabase_user_id: user.id,
          dj_profile_id: djProfile.id,
        },
      },
      {
        /* Mode in the key so a test account is not deduped against
           the live one created for the same DJ. */
        idempotencyKey: `playing-next-connect-${stripeMode()}-${djProfile.id}`,
      }
    );

    const { error: saveError } = await supabaseAdmin
      .from("dj_profiles")
      /*
       * Written to the columns for the current mode. This is the write
       * that must never cross environments: putting a sandbox account id
       * into stripe_account_id would break a real DJ's real payouts, and
       * we could not recover the original from our side.
       */
      .update({
        [connectColumns().accountId]: account.id,
        [connectColumns().connected]: false,
      })
      .eq("id", djProfile.id);

    if (saveError) {
      /*
       * Stripe has an account; we could not record it. This is the one
       * path that can orphan a Connect account, so it fails loudly and
       * never invites another attempt.
       *
       * The idempotency key above dedupes retries, but Stripe expires
       * those after 24 hours — so a retry a day later, with the column
       * still empty, would create a second account and leave the first
       * stranded. The `code` below is what the payments page keys on to
       * show a recovery state instead of a Start setup button, and the
       * id is logged at error level so the account can be reattached by
       * hand rather than abandoned.
       *
       * Retried once first, because the overwhelmingly likely cause is a
       * transient database error rather than anything about Stripe.
       */
      console.error(
        `Connect account ${account.id} created but NOT saved for dj_profile ${djProfile.id}:`,
        saveError
      );

      const { error: retryError } = await supabaseAdmin
        .from("dj_profiles")
        .update({
          [connectColumns().accountId]: account.id,
          [connectColumns().connected]: false,
        })
        .eq("id", djProfile.id);

      if (retryError) {
        console.error(
          `RECONCILE MANUALLY: dj_profile ${djProfile.id} -> ${account.id} (${stripeMode()})`,
          retryError
        );

        return NextResponse.json(
          {
            error:
              "Your Stripe account was created but we couldn't link it to your profile. Please contact support rather than trying again, so we can attach the existing account.",
            code: "account_created_not_linked",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      accountId: account.id,
      created: true,
    });
  } catch (error) {
    /* Full detail to the log, a generic sentence to the client. The old
       response forwarded Stripe's own message and status code straight
       through, which names internal parameters and key prefixes. */
    console.error("Stripe connected account error:", error);

    return NextResponse.json(
      { error: "Stripe could not set up your account. Please try again." },
      { status: 500 }
    );
  }
}