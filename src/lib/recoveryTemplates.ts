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
    A: "Two steps from your first paid request",
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
    A: "Your QR code is ready. Payouts are what is missing.",
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
    if (state === "B") return "One step from your first paid request";
    return "Payouts are on. One step left.";
  }

  if (state === "B") return "One step from your first paid request";
  return "Your QR code is still waiting";
}

/*
 * The opening leads with what is already done, then names what is
 * blocking. Both halves matter: opening on the failure reads as a
 * telling-off, and omitting it would hide the one fact the DJ most needs
 * to know, which is that payouts are what stops a guest paying.
 *
 * The request page URL is deliberately not printed. Written out in full
 * it becomes the loudest thing in the email, and mail clients auto-link
 * bare URLs in their own browser blue, which is the one colour in the
 * message nobody chose.
 */
function introFor(
  template: RecoveryTemplate,
  state: Exclude<RecoveryState, "ready">
): string {
  const blocked =
    "Until payouts are connected, a guest who scans your code cannot pay you.";

  if (template === "recovery_1") {
    if (state === "A") {
      return `Your request page is already live and your QR code is ready. Two things are still missing. ${blocked}`;
    }
    if (state === "B") {
      return `Your profile is finished and your QR code is ready. Payouts are the last piece. ${blocked}`;
    }
    return 'Payouts are connected, so the hard part is done. Your page still shows "New DJ" though, so guests scanning your code will not know it is you.';
  }

  if (state === "B") {
    return `Everything else is done and your QR code is waiting. ${blocked}`;
  }

  return "This is the last reminder we will send about setting up. Your page is live, and it is one short step from taking a request at your next set.";
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

  /*
   * State-aware and specific, approved 2026-09-02. "Continue setup" for
   * A because two different things are outstanding and naming only one
   * of them would be misleading; the other two states have exactly one
   * thing left, so the button says what it is.
   */
  const ctaLabel =
    state === "A" ? "Continue setup" : state === "B" ? "Finish connecting payouts" : "Finish your profile";

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
          payoffTitle: "Ready for your next set",
          payoffBody:
            "Display your QR code at your next set. Guests scan it, request a song and pay. You decide what gets played, and the money lands in your account.",
        };

  const content: EmailContent = {
    logoUrl: `${baseUrl}/icons/icon-192.png`,
    preheader: PREHEADERS[template][state],
    heading: headingFor(template, state, profile),
    intro: introFor(template, state),
    steps,
    ctaLabel,
    ctaHref: href,
    ctaNote: template === "recovery_1" ? "You can do this from your phone" : undefined,
    ...payoff,
    /*
     * Repeated on R1 only.
     *
     * R1 carries a five-row journey, so by the time the reader reaches
     * the outcome block the button is well off screen on a phone and a
     * second one catches them at the point of highest intent.
     *
     * R2 deliberately does not. It is three rows and its outcome block
     * is the invitation to reply, so a second green button directly
     * under "tell me what got in the way" would compete with the exact
     * response that email is asking for.
     */
    repeatCta: template === "recovery_1",
    footerReason:
      template === "recovery_1"
        ? "You are receiving this because you created a Playing Next DJ account and have not finished setting it up. We will send one more reminder and then stop."
        : "This is the last setup reminder we will send. Your account stays exactly as it is.",
    unsubscribeHref,
  };

  const { html, text } = renderEmail(content);

  return { subject: SUBJECTS[template][state], html, text };
}
