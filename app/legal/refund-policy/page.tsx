import { LegalDoc, H2, P, Ul, Note } from "@/src/components/legal/LegalDoc";

export const metadata = {
  title: "Refund & Cancellation Policy | Playing Next",
};

export default function RefundPolicyPage() {
  return (
    <LegalDoc title="Refund & Cancellation Policy" lastUpdated="19 August 2026">
      <Note>
        <strong>Draft: not yet legally reviewed.</strong>{" "}Before a DJ
        accepts, nothing has been charged and you can cancel yourself at
        any time. Once a DJ accepts, it&rsquo;s final in the ordinary
        course — the one exception is if your song is genuinely never
        played at all. See section 3.
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
          If the DJ doesn&rsquo;t respond within <strong>2 hours</strong>,
          the authorisation is released automatically and you&rsquo;re
          not charged, either. (As a backstop, Stripe also expires any
          authorisation on its own after 7 days regardless.)
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
        purchase. The DJ has committed to add your song to their queue
        and play it during their set.
      </P>
      <P>
        <strong>This isn&rsquo;t reversible just because you change your
        mind, ask the DJ to skip it, or their set runs differently than
        you hoped.</strong>{" "}Once accepted, a request is final in the
        ordinary course of events. The one exception, covered in section
        3, is if your song is never actually played at all. This
        doesn&rsquo;t affect any statutory rights you may have that
        can&rsquo;t be excluded by agreement, or your right to raise a
        dispute with your card issuer (see section 6).
      </P>
      <P>
        The 50p guest service fee is non-refundable in every case, as it
        covers payment processing costs already incurred.
      </P>

      <H2>3. If your song was never played</H2>
      <P>
        Playing Next isn&rsquo;t present at your event and can&rsquo;t
        verify what a DJ actually plays through their speakers. So we
        don&rsquo;t take a guest&rsquo;s word for it automatically, and we
        don&rsquo;t take a DJ&rsquo;s word for it automatically either.
      </P>
      <P>
        If your request was accepted, or even marked &ldquo;Played&rdquo;,
        but you&rsquo;re confident you never actually heard it, you can
        report it as &ldquo;This wasn&rsquo;t played&rdquo; from{" "}
        <strong>My Requests</strong>{" "}or your confirmation page, any time
        after it&rsquo;s been accepted. You can only report a given
        request once.
      </P>
      <P>
        Reporting a request doesn&rsquo;t issue an automatic refund — it
        flags the request for us to look into. We weigh things like
        whether the DJ&rsquo;s session ended with your request still
        unplayed, and how often that DJ gets reported this way, alongside
        your report itself. If we determine a claim is legitimate, we may
        refund you and reclaim the DJ&rsquo;s share of that payment (see
        our{" "}
        <a href="/legal/dj-terms" className="text-accent hover:underline">
          DJ Terms
        </a>
        ). If we don&rsquo;t, we may decline to refund it.
      </P>
      <P>
        We do this specifically because a DJ is paid the instant they
        accept a request: reviewing genuine &ldquo;never played&rdquo;
        claims is the real check against a DJ accepting requests with no
        intention of playing them, without turning every accepted request
        into something either side can walk back on a whim.
      </P>

      <H2>4. Cancelling a request yourself</H2>
      <P>
        While a request is still pending, you can cancel it yourself from
        the confirmation page or My Requests. This releases the card
        authorisation immediately and you&rsquo;re not charged. This is
        your last chance to change your mind before the DJ responds: once
        they accept, see sections 2 and 3 for what applies instead.
      </P>

      <H2>5. Card declines or payment issues</H2>
      <P>
        If your card is declined at checkout, your request simply
        isn&rsquo;t submitted. Nothing is charged, and you&rsquo;re free
        to try again with a different card.
      </P>

      <H2>6. Disputes and chargebacks</H2>
      <P>
        Nothing in this policy affects your right to raise a dispute or
        chargeback directly with your card issuer or bank under their own
        rules.
      </P>

      <H2>7. DJs</H2>
      <P>
        This policy covers guest payments and refunds. If a refund is
        issued for a request that was never played, the DJ&rsquo;s share
        of that specific payment may be reclaimed from a future payout,
        the same way a card chargeback is handled. DJ payouts more
        broadly, once transferred, follow Stripe&rsquo;s own terms for
        connected accounts. See our{" "}
        <a href="/legal/dj-terms" className="text-accent hover:underline">
          DJ Terms
        </a>
        .
      </P>

      <H2>8. Contact</H2>
      <P>
        For anything refund-related, contact{" "}
        <a href="mailto:info@playingnextapp.com" className="text-accent hover:underline">
          info@playingnextapp.com
        </a>
        .
      </P>
    </LegalDoc>
  );
}
