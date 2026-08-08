import { LegalDoc, H2, P, Ul, Note } from "@/src/components/legal/LegalDoc";

export const metadata = {
  title: "Refund & Cancellation Policy | Playing Next",
};

export default function RefundPolicyPage() {
  return (
    <LegalDoc title="Refund & Cancellation Policy" lastUpdated="7 August 2026">
      <Note>
        <strong>Draft — not yet legally reviewed.</strong>{" "}Once a DJ
        accepts a request, it&rsquo;s final: no refunds, for any reason.
        Before that point, nothing has been charged and you can cancel
        yourself at any time — see below.
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
        <strong>Once a DJ has accepted your request, it&rsquo;s final and
        non-refundable</strong>{" "}— including if the DJ&rsquo;s set ends
        before your song is played, or for any other reason once
        acceptance has happened. The DJ is paid the moment they accept,
        precisely so they can rely on that being final; we don&rsquo;t
        reverse it afterwards. This doesn&rsquo;t affect any statutory
        rights you may have that can&rsquo;t be excluded by agreement, or
        your right to raise a dispute with your card issuer (see section
        5).
      </P>
      <P>
        The 50p guest service fee is likewise non-refundable once a
        request has been accepted and charged, as it covers payment
        processing costs already incurred.
      </P>

      <H2>3. Cancelling a request yourself</H2>
      <P>
        While a request is still pending, you can cancel it yourself from
        the confirmation page or My Requests — this releases the card
        authorisation immediately and you&rsquo;re not charged. This is
        your last chance to change your mind: once the DJ accepts, it
        can&rsquo;t be cancelled or refunded (see section 2).
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
