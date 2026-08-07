import { LegalDoc, H2, P, Ul, Note } from "@/src/components/legal/LegalDoc";

export const metadata = {
  title: "Guest Terms | Playing Next",
};

export default function GuestTermsPage() {
  return (
    <LegalDoc title="Guest Terms" lastUpdated="7 August 2026">
      <Note>
        <strong>Draft — not yet legally reviewed.</strong>{" "}This describes
        how the product actually works today. It should be reviewed by a
        solicitor, particularly the liability and marketplace-facilitator
        sections, before we rely on it at public launch.
      </Note>

      <P>
        These terms apply whenever you use Playing Next as a guest to
        request a song from a DJ. By submitting a request and paying, you
        agree to them.
      </P>

      <H2>1. What Playing Next is</H2>
      <P>
        Playing Next is a marketplace that lets you pay a DJ to request a
        song at an event they&rsquo;re playing. We provide the platform,
        take the payment, and route your request to the DJ — but the DJ
        decides what to actually play. We are not the DJ, and we don&rsquo;t
        control their set.
      </P>

      <H2>2. Making a request</H2>
      <P>
        When you submit a request, you&rsquo;ll pay the DJ&rsquo;s listed
        price for that request type, plus a fixed 50p guest service fee
        that covers payment processing and platform costs. Your card is{" "}
        <strong>authorised, not charged</strong>, at the moment you submit
        the request.
      </P>
      <Ul>
        <li>
          If the DJ <strong>accepts</strong>{" "}your request, your card is
          charged at that point, and the DJ is paid their share.
        </li>
        <li>
          If the DJ <strong>declines</strong>{" "}your request, or doesn&rsquo;t
          respond within 7 days, the authorisation is released
          automatically and you are not charged.
        </li>
      </Ul>
      <P>
        There is currently no way to cancel a request yourself once
        it&rsquo;s submitted and awaiting the DJ&rsquo;s response — if you
        no longer want it actioned, speak to the DJ directly, or contact
        us and we&rsquo;ll do what we can.
      </P>

      <H2>3. No guarantee your song will be played</H2>
      <P>
        A DJ accepting your request means they&rsquo;ve committed to
        adding it to their queue — it is not a guarantee of the exact time
        it will play, and we can&rsquo;t guarantee it will play at all if
        the DJ&rsquo;s set ends early, or for other reasons outside the
        DJ&rsquo;s control (venue curfews, technical issues, and similar).
        See our{" "}
        <a href="/legal/refund-policy" className="text-accent hover:underline">
          Refund &amp; Cancellation Policy
        </a>{" "}
        for what happens if that occurs.
      </P>

      <H2>4. Messages and content</H2>
      <P>
        If you add a message to your request, it&rsquo;s shown to the DJ
        as you wrote it. Don&rsquo;t include anything illegal, abusive,
        or that infringes someone else&rsquo;s rights. A DJ may decline
        any request, for any reason, including its message content.
      </P>

      <H2>5. Music licensing</H2>
      <P>
        Playing tracks at an event requires the DJ or venue to hold the
        appropriate music licence (for example, from PRS for Music or
        PPL in the UK). That&rsquo;s the DJ&rsquo;s and/or venue&rsquo;s
        responsibility, not ours — we don&rsquo;t license, host, or
        distribute any music ourselves; we only facilitate the request
        and payment.
      </P>

      <H2>6. Fees are non-negotiable</H2>
      <P>
        Request and Song + Message prices are set by each DJ individually.
        The 50p guest service fee is fixed and applies to every request
        regardless of outcome pricing.
      </P>

      <H2>7. Liability</H2>
      <P>
        The platform is provided &ldquo;as is&rdquo;. To the fullest
        extent the law allows, we&rsquo;re not liable for indirect or
        consequential losses, or for the DJ&rsquo;s conduct, performance,
        or decisions about what to play. DJs using Playing Next are
        independent third parties, not our employees or agents. Nothing
        in this section limits liability that can&rsquo;t legally be
        limited, such as for fraud.
      </P>

      <H2>8. Suspending access</H2>
      <P>
        We can suspend or restrict access to the platform for anyone
        found abusing it — for example, submitting fraudulent payments or
        abusive message content.
      </P>

      <H2>9. Governing law</H2>
      <P>
        These terms are governed by the law of England and Wales.
      </P>

      <H2>10. Complaints &amp; contact</H2>
      <P>
        Questions about these terms, or about a specific request? Contact{" "}
        <strong>[support email — TBD]</strong>. If you want to raise a
        complaint, use the same address and describe what happened,
        including your request ID if you have one — we aim to acknowledge
        it within 5 business days.
      </P>
      <P>
        This covers complaints about Playing Next itself. A complaint
        about a payment or your card being charged should still be sent
        to us first; if it turns out to be something only Stripe can
        resolve, we&rsquo;ll point you to them.
      </P>
    </LegalDoc>
  );
}
