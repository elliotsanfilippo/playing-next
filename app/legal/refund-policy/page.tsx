import { LegalDoc, H2, P, Ul, Note } from "@/src/components/legal/LegalDoc";

export const metadata = {
  title: "Refund & Cancellation Policy | Playing Next",
};

export default function RefundPolicyPage() {
  return (
    <LegalDoc title="Refund & Cancellation Policy" lastUpdated="7 August 2026">
      <Note>
        <strong>Draft — not yet legally reviewed.</strong>{" "}This describes
        exactly what the product does today, including a real gap: there
        is currently no in-app refund button for captured payments.
        Requests raised through the contact route below are handled
        manually by us until that&rsquo;s built.
      </Note>

      <H2>1. Before a DJ responds</H2>
      <P>
        When you submit a request, your card is <strong>authorised</strong>,
        not charged. Nothing is taken from your account at this stage.
      </P>
      <Ul>
        <li>
          If the DJ <strong>declines</strong>{" "}your request, the
          authorisation is released automatically and you&rsquo;re not
          charged.
        </li>
        <li>
          If the DJ doesn&rsquo;t respond within <strong>7 days</strong>,
          Stripe automatically expires the authorisation and you&rsquo;re
          not charged, either.
        </li>
      </Ul>
      <P>
        In both cases there&rsquo;s nothing to refund, because nothing was
        ever taken.
      </P>

      <H2>2. Once a DJ accepts</H2>
      <P>
        Accepting a request charges your card immediately, and pays the
        DJ their share at the same time. This is treated as a completed
        purchase — the DJ has committed to add your song to their queue.
      </P>
      <P>
        There&rsquo;s currently no self-service refund option in the app
        for a request that&rsquo;s already been accepted and charged. If
        something goes wrong — for example the DJ&rsquo;s set ends before
        your song is played — contact us at{" "}
        <strong>[support email — TBD]</strong>{" "}with your request details
        and we&rsquo;ll review it manually.
      </P>
      <P>
        The 50p guest service fee is non-refundable once a request has
        been accepted and charged, as it covers payment processing costs
        already incurred.
      </P>

      <H2>3. Cancelling a request yourself</H2>
      <P>
        There&rsquo;s no button in the app for a guest to cancel their own
        pending request. If you want to withdraw a request before the DJ
        responds, the most reliable option is to speak to the DJ directly
        at the event. You can also contact us and we&rsquo;ll try to help,
        but we can&rsquo;t guarantee a DJ won&rsquo;t accept it before we
        do.
      </P>

      <H2>4. Card declines or payment issues</H2>
      <P>
        If your card is declined at checkout, your request simply
        isn&rsquo;t submitted — nothing is charged, and you&rsquo;re free
        to try again with a different card.
      </P>

      <H2>5. Disputes and chargebacks</H2>
      <P>
        Nothing in this policy affects your right to raise a dispute or
        chargeback directly with your card issuer or bank under their own
        rules.
      </P>

      <H2>6. DJs</H2>
      <P>
        This policy covers guest payments. DJ payouts, once transferred,
        follow Stripe&rsquo;s own terms for connected accounts — see our{" "}
        <a href="/legal/dj-terms" className="text-accent hover:underline">
          DJ Terms
        </a>
        .
      </P>

      <H2>7. Contact</H2>
      <P>
        For anything refund-related, contact{" "}
        <strong>[support email — TBD]</strong>.
      </P>
    </LegalDoc>
  );
}
