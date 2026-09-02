import { renderEmail, type EmailContent, type EmailStep } from "./emailLayout.ts";
import {
  outstanding,
  payoutsReady,
  profileComplete,
  stripeStarted,
  type RecoveryProfile,
  type RecoveryState,
  type RecoveryTemplate,
} from "./recoveryEligibility.ts";

/*
 * ── The two recovery emails, rendered from live product state ─────
 *
 * Rules the copy obeys, all of them Elliot's:
 *
 *   * Never say how long something takes. There is no measurement
 *     behind "two minutes", and a DJ told that and then met a Stripe
 *     identity check was misled by us, not by Stripe.
 *   * Never say "complete your onboarding". That is our internal funnel
 *     stage. Their goal is a paid request at their next gig.
 *   * Never instruct someone to do something already done. Every row is
 *     built from the profile as it is at send time.
 *   * The QR code is ready and waiting, because it exists from signup.
 *     Presenting it as a task to complete would be the decorative fake
 *     progress that was explicitly ruled out.
 *   * The first paid request is the payoff, never a setup step.
 *   * No em or en dashes, no emoji, no urgency, no marketing voice.
 */

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

/** The two rows that close every R1: the reward, not the work. */
function payoffSteps(profile: RecoveryProfile): EmailStep[] {
  return [
    {
      state: "future",
      label: "Your QR code is ready and waiting",
      detail: payoutsReady(profile)
        ? "Nothing else to set up after this"
        : "It works the moment payouts are on",
    },
    {
      state: "future",
      label: "Your first paid request",
      detail: `Requests are set to ${formatPrice(profile.request_price)}. You can change that any time`,
    },
  ];
}

function formatPrice(pence: number | null): string {
  const value = (pence ?? 0) / 100;
  return value % 1 === 0 ? `£${value.toFixed(0)}` : `£${value.toFixed(2)}`;
}

/** "name and photo", "name", "photo" - only what is genuinely missing. */
function profileGap(profile: RecoveryProfile): string {
  const missing = outstanding(profile).filter((m) => m !== "payouts" && m !== "price");

  if (missing.length === 2) return "name and photo";
  if (missing[0] === "photo") return "photo";
  return "name";
}

function payoutsDetail(profile: RecoveryProfile): string {
  return stripeStarted(profile)
    ? "You started this with Stripe. Pick up where you left off"
    : "Stripe handles the bank details, not us";
}

function r1Steps(profile: RecoveryProfile, state: RecoveryState): EmailStep[] {
  const steps: EmailStep[] = [
    { state: "done", label: "Account created", detail: "Your link and QR code already exist" },
  ];

  if (state === "C") {
    steps.push({
      state: "done",
      label: "Payouts connected",
      detail: "You can take money as soon as your page is ready",
    });
  }

  if (state === "B") {
    steps.push({
      state: "done",
      label: "Profile finished",
      detail: "Name, photo and price all set",
    });
  }

  let n = 1;

  if (!profileComplete(profile)) {
    steps.push({
      state: "todo",
      index: n++,
      label: `Add your DJ ${profileGap(profile)}`,
      detail:
        profile.dj_name === "New DJ"
          ? 'Your page currently reads "New DJ"'
          : "So guests know they have the right DJ",
    });
  }

  if (!payoutsReady(profile)) {
    steps.push({
      state: "todo",
      index: n++,
      label: "Connect payouts",
      detail: payoutsDetail(profile),
    });
  }

  return [...steps, ...payoffSteps(profile)];
}

/*
 * R2 is shorter on purpose. A last reminder that repeats the first one
 * at the same length reads as a system, not a person, and the whole
 * point of the second message is the offer to reply.
 */
function r2Steps(profile: RecoveryProfile, state: RecoveryState): EmailStep[] {
  const steps: EmailStep[] = [];

  if (state === "B") {
    steps.push({ state: "done", label: "Profile finished", detail: "Name, photo and price all set" });
  } else if (state === "C") {
    steps.push({ state: "done", label: "Payouts connected", detail: "The hard part is done" });
  } else {
    steps.push({ state: "done", label: "Account created", detail: "Your link and QR code already exist" });
  }

  let n = 1;

  if (!profileComplete(profile)) {
    steps.push({ state: "todo", index: n++, label: `Add your DJ ${profileGap(profile)}` });
  }

  if (!payoutsReady(profile)) {
    steps.push({ state: "todo", index: n++, label: "Connect payouts", detail: payoutsDetail(profile) });
  }

  steps.push({
    state: "future",
    label: "Take your first request",
    detail: "Nothing else to do after this",
  });

  return steps;
}

const SUBJECTS: Record<RecoveryTemplate, Record<Exclude<RecoveryState, "ready">, string>> = {
  recovery_1: {
    A: "Your Playing Next page cannot take payment yet",
    B: "One step between you and your first paid request",
    C: "One step left on your Playing Next setup",
  },
  recovery_2: {
    A: "Last reminder about your Playing Next setup",
    B: "Your page is ready, payouts are not",
    C: "Last reminder about your Playing Next setup",
  },
};

const PREHEADERS: Record<RecoveryTemplate, Record<Exclude<RecoveryState, "ready">, string>> = {
  recovery_1: {
    A: "Two things left before a guest can pay you.",
    B: "Your profile is done. Payouts are the last piece.",
    C: "Payouts are connected. Your profile is the last thing.",
  },
  recovery_2: {
    A: "Your QR code is waiting. Tell me if something is in the way.",
    B: "Last reminder. If Stripe got in the way, tell me.",
    C: "Your QR code is waiting. Tell me if something is in the way.",
  },
};

function headingFor(
  template: RecoveryTemplate,
  state: Exclude<RecoveryState, "ready">,
  profile: RecoveryProfile
): string {
  if (template === "recovery_1") {
    if (state === "A") {
      return outstanding(profile).length > 2
        ? "Two things left before your first request"
        : "Two steps from your first request";
    }
    if (state === "B") return "Your page is ready. Payouts are not.";
    return "Payouts are on. One step left.";
  }

  if (state === "B") return "Your page is ready. Payouts are not.";
  return "Your QR code is still waiting";
}

function introFor(
  template: RecoveryTemplate,
  state: Exclude<RecoveryState, "ready">,
  profile: RecoveryProfile,
  baseUrl: string
): string {
  const link = `${baseUrl.replace(/^https?:\/\//, "")}/request/${profile.slug ?? ""}`;

  if (template === "recovery_1") {
    if (state === "A") {
      return `Your request page is already live at ${link}. Right now a guest who scans it cannot pay you, because payouts are not connected yet.`;
    }
    if (state === "B") {
      return "Everything else is done. If a guest scanned your code tonight they would see your page, choose a song, and then hit a wall at payment.";
    }
    return 'You have done the hard part. Your page still shows "New DJ" though, so guests scanning your code will not know it is you.';
  }

  if (state === "B") {
    return "Everything else is done. If a guest scanned your code tonight they would see your page, choose a song, and then hit a wall at payment.";
  }

  return "This is the last reminder we will send about setting up. Your page is live, and it is one short step from being able to take a request at your next set.";
}

export type RenderOptions = {
  profile: RecoveryProfile;
  template: RecoveryTemplate;
  state: Exclude<RecoveryState, "ready">;
  baseUrl: string;
  unsubscribeHref: string;
  /** True when a monitored Reply-To is configured, so R2 may offer it. */
  repliesMonitored: boolean;
};

export function renderRecoveryEmail(options: RenderOptions): RenderedEmail {
  const { profile, template, state, baseUrl, unsubscribeHref, repliesMonitored } = options;

  const steps = template === "recovery_1" ? r1Steps(profile, state) : r2Steps(profile, state);
  const href = `${baseUrl}${
    profileComplete(profile) ? "/dj/settings/payments?from=onboarding" : "/dj/settings?from=onboarding"
  }`;

  const ctaLabel = !profileComplete(profile)
    ? `Add your ${profileGap(profile)}`
    : "Finish connecting payouts";

  /*
   * R2 offers a reply only when there is somewhere for it to land. An
   * invitation to reply sent from an unmonitored address is worse than
   * no invitation, and this is the one email whose purpose is to find
   * out what stopped somebody.
   */
  const payoff =
    template === "recovery_2" && repliesMonitored
      ? {
          payoffTitle: "If something got in the way",
          payoffBody:
            "Reply to this email and it comes straight to me. If Stripe asked for something awkward, or you have decided Playing Next is not for you, I would genuinely rather know.",
        }
      : {
          payoffTitle: "What finishing gets you",
          payoffBody:
            "Display your QR code at your next set. Guests scan it, request a song and pay. You decide what gets played, and the money lands in your account.",
        };

  const content: EmailContent = {
    preheader: PREHEADERS[template][state],
    heading: headingFor(template, state, profile),
    intro: introFor(template, state, profile, baseUrl),
    steps,
    ctaLabel,
    ctaHref: href,
    ctaNote: template === "recovery_1" ? "You can do this from your phone" : undefined,
    ...payoff,
    footerReason:
      template === "recovery_1"
        ? "You are receiving this because you created a Playing Next DJ account and have not finished setting it up. We will send one more reminder and then stop."
        : "This is the last setup reminder we will send. Your account stays exactly as it is.",
    unsubscribeHref,
  };

  const { html, text } = renderEmail(content);

  return { subject: SUBJECTS[template][state], html, text };
}
