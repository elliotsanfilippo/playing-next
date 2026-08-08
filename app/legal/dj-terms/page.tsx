import { LegalDoc, H2, P, Ul, Note } from "@/src/components/legal/LegalDoc";

export const metadata = {
  title: "DJ Terms | Playing Next",
};

export default function DjTermsPage() {
  return (
    <LegalDoc title="DJ Terms" lastUpdated="7 August 2026">
      <Note>
        <strong>Draft — not yet legally reviewed.</strong>{" "}The payments
        marketplace structure described here (destination charges via
        Stripe Connect, DJ as independent third party, tax responsibility)
        is exactly what a solicitor should sign off on before we rely on
        it at public launch — see the note in our roadmap.
      </Note>

      <P>
        These terms apply to any DJ using Playing Next to receive and get
        paid for song requests. By creating a DJ account, you agree to
        them.
      </P>

      <H2>1. Eligibility</H2>
      <P>
        You must be at least 18, and provide accurate information about
        yourself and your DJ profile. Stripe Connect, which we use to pay
        you out, also requires you to be a legal adult in your
        jurisdiction.
      </P>

      <H2>2. Getting paid — Stripe Connect</H2>
      <P>
        We use Stripe Connect to pay DJs directly. When you connect
        payments, you go through Stripe&rsquo;s own onboarding flow, where
        Stripe collects your identity, business, and bank details
        directly — we never see or store this ourselves, and Stripe&rsquo;s
        own terms and privacy policy govern that relationship. You need a
        fully onboarded, active Stripe account before guests can pay you.
      </P>

      <H2>3. How the money flows</H2>
      <P>
        When a guest submits a request, their card is authorised for the
        request price plus a fixed 50p guest service fee — nothing is
        charged yet.
      </P>
      <Ul>
        <li>
          If you <strong>accept</strong>{" "}the request, the guest is charged
          immediately, and your share is transferred to your connected
          Stripe account the same moment.
        </li>
        <li>
          If you <strong>decline</strong>, or don&rsquo;t respond within 7
          days, the authorisation is automatically released and the guest
          is never charged.
        </li>
      </Ul>
      <P>
        The 50p guest service fee is retained by Playing Next in every
        case and is never part of your payout.
      </P>

      <H2>4. Fees</H2>
      <P>
        <strong>Free plan</strong>{" "}(default): we take a 15% platform fee
        of the request price on every accepted request; you keep the
        remaining 85%.
      </P>
      <P>
        <strong>Pro plan</strong>{" "}(£14.99/month): a 0% platform fee —
        you keep 100% of the request price on accepted requests. Billed
        monthly via Stripe; manage or cancel your subscription any time
        from your account settings. If your payment fails, your account
        automatically reverts to the Free plan&rsquo;s 15% fee until it&rsquo;s
        resolved, rather than being suspended outright.
      </P>
      <P>
        If we ever change these rates, we&rsquo;ll give existing DJs
        reasonable advance notice before the change applies to them.
      </P>

      <H2>5. Payouts</H2>
      <P>
        Once a transfer reaches your Stripe account, when it actually
        lands in your bank follows Stripe&rsquo;s own payout schedule for
        your account, which we don&rsquo;t control.
      </P>

      <H2>6. Your responsibilities</H2>
      <Ul>
        <li>
          Keep your profile, pricing, and availability status accurate,
          and respond to requests in a reasonable time
        </li>
        <li>
          Hold or obtain whatever music licence is required to legally
          play tracks at your events (for example, via PRS for Music or
          PPL in the UK, or your venue&rsquo;s existing licence) — this is
          your responsibility, not ours; we don&rsquo;t license or provide
          music
        </li>
        <li>
          Handle your own tax affairs. Using Playing Next does not make
          you our employee — you&rsquo;re responsible for declaring and
          paying any tax due on your earnings. We don&rsquo;t deduct PAYE
          or provide tax advice; speak to an accountant if you&rsquo;re
          unsure.
        </li>
        <li>Comply with the rules of any venue you perform at</li>
      </Ul>

      <H2>7. Independent status</H2>
      <P>
        You use Playing Next as an independent DJ, not as our employee,
        worker, partner, or agent. We facilitate the request and the
        payment; we&rsquo;re not a party to what happens at your event.
      </P>

      <H2>8. Prohibited conduct</H2>
      <P>
        Don&rsquo;t misrepresent your identity during Stripe onboarding,
        set prices intended to defraud guests, or otherwise abuse the
        platform. We can suspend or terminate accounts found doing so,
        and Stripe may independently restrict your Connect account under
        their own terms.
      </P>

      <H2>9. Liability</H2>
      <P>
        The platform is provided &ldquo;as is&rdquo;. To the fullest
        extent the law allows, we&rsquo;re not liable for indirect or
        consequential losses, including lost earnings from platform
        downtime. Nothing in this section limits liability that can&rsquo;t
        legally be limited, such as for fraud.
      </P>

      <H2>10. Ending this agreement</H2>
      <P>
        You can stop using Playing Next at any time. We can suspend or
        terminate your account for breach of these terms, fraud, or if
        Stripe restricts your connected account.
      </P>

      <H2>11. Governing law</H2>
      <P>These terms are governed by the law of England and Wales.</P>

      <H2>12. Complaints &amp; contact</H2>
      <P>
        Questions about these terms, fees, or your account? Contact{" "}
        <strong>[support email — TBD]</strong>. If you want to raise a
        complaint — about a payout, a fee, or anything else — use the
        same address; we aim to acknowledge it within 5 business days.
      </P>
      <P>
        This covers complaints about Playing Next itself, not about your
        Stripe account directly — issues with your connected account
        (verification, payout delays, restrictions) are Stripe&rsquo;s to
        resolve under your agreement with them, though we&rsquo;re happy
        to help however we can.
      </P>
    </LegalDoc>
  );
}
