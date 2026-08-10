import { LegalDoc, H2, P, Ul, Note } from "@/src/components/legal/LegalDoc";

export const metadata = {
  title: "Privacy Policy | Playing Next",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDoc title="Privacy Policy" lastUpdated="7 August 2026">
      <Note>
        <strong>Draft — not yet legally reviewed.</strong>{" "}The facts below
        (what we collect, who we share it with) are accurate to how the
        product currently works. The bracketed company details still need
        filling in once our business structure is finalised, and this
        document as a whole should be reviewed by a solicitor before we
        rely on it at public launch.
      </Note>

      <P>
        Playing Next (&ldquo;we&rdquo;, &ldquo;us&rdquo;) operates a
        platform that lets guests at an event pay to request a song from a
        DJ. This policy explains what personal data we collect from
        guests and DJs, why, and what your rights are.
      </P>

      <P>
        Data controller: <strong>[Registered business/trading name — TBD]</strong>,{" "}
        <strong>[registered address — TBD]</strong>. Contact us at{" "}
        <a href="mailto:info@playingnextapp.com" className="text-accent hover:underline">
          info@playingnextapp.com
        </a>{" "}
        for anything in this policy, including exercising any of the rights
        below.
      </P>

      <H2>1. Information we collect</H2>

      <P>
        <strong>If you&rsquo;re a guest making a request</strong>, you don&rsquo;t
        create an account with us. We store:
      </P>
      <Ul>
        <li>The song title and artist you request</li>
        <li>
          An optional message, if you choose &ldquo;Song + Message&rdquo; —
          whatever you type is stored as-is, so please don&rsquo;t include
          personal details you don&rsquo;t want kept
        </li>
      </Ul>
      <P>
        Your browser also stores a list of your own request IDs in{" "}
        <code>localStorage</code>{" "}on your device, scoped to the DJ you
        requested from, so the &ldquo;My Requests&rdquo; page can show you
        your own history. This never leaves your device and isn&rsquo;t
        something we can see.
      </P>
      <P>
        When you pay, you&rsquo;re taken to Stripe&rsquo;s own checkout
        page. Stripe collects your <strong>email address</strong>{" "}and{" "}
        <strong>cardholder name</strong>, and processes your card details
        directly — we never see or store your card details ourselves.
      </P>

      <P>
        <strong>If you&rsquo;re a DJ</strong>, you create an account, which
        involves more data:
      </P>
      <Ul>
        <li>
          Email and password, held by our authentication provider
          (Supabase)
        </li>
        <li>
          Your DJ name, slug, bio, genres, profile photo, and prices —
          all self-entered and, by design, publicly visible on your
          profile page
        </li>
        <li>
          When you connect payouts, Stripe collects your legal identity
          details directly — full name, date of birth, address, and bank
          account details — as part of their own onboarding flow. We
          never see or store this; we only hold a reference ID to your
          Stripe account.
        </li>
      </Ul>

      <H2>2. Why we use it, and on what basis</H2>
      <Ul>
        <li>
          <strong>To operate the service</strong>{" "}— taking and routing
          requests, processing payments, showing DJs their queue. This is
          necessary to perform our contract with you.
        </li>
        <li>
          <strong>To keep the platform secure</strong>{" "}— for example, we
          use IP addresses transiently, in memory only, to rate-limit
          abusive request volume. This is a legitimate interest in
          preventing abuse.
        </li>
        <li>
          <strong>To fix bugs</strong>{" "}— our error-monitoring tool
          (Sentry) may capture technical details about an error, including
          IP address and browser information, when something breaks.
        </li>
      </Ul>
      <P>We don&rsquo;t use your data for advertising, and we don&rsquo;t sell it.</P>

      <H2>3. Who we share it with</H2>
      <P>
        We use a small number of third-party processors to run the
        service. Each only receives what it needs to do its job:
      </P>
      <Ul>
        <li>
          <strong>Supabase</strong>{" "}— hosts our database, DJ
          authentication, and profile images
        </li>
        <li>
          <strong>Stripe</strong>{" "}— processes guest payments and DJ payouts
          (Stripe Connect); collects guest email/payment details and DJ
          identity/bank details directly
        </li>
        <li>
          <strong>Spotify</strong>{" "}— receives the song/artist text you
          search for, so we can show matching tracks; we use app-level
          credentials, not your personal Spotify account, so no
          identifying information about you is sent
        </li>
        <li>
          <strong>Sentry</strong>{" "}— receives technical error reports to
          help us fix bugs
        </li>
        <li>
          <strong>Vercel</strong>{" "}— hosts the website and its server
          functions, and by nature of running the servers, logs request
          traffic including IP addresses
        </li>
      </Ul>
      <Note>
        We haven&rsquo;t yet confirmed the data-residency region for our
        Supabase and Vercel projects. We&rsquo;ll update this section once
        that&rsquo;s confirmed, since it affects whether any international
        transfer safeguards are needed.
      </Note>

      <H2>4. How long we keep it</H2>
      <P>
        Honestly: we don&rsquo;t yet have an automated retention or deletion
        schedule. Request records (including guest messages) are
        currently kept indefinitely. A DJ hiding a request from their own
        dashboard view doesn&rsquo;t delete the underlying record.
      </P>
      <P>
        We&rsquo;re aware this needs to change before we can consider our
        retention practice fully compliant, and it&rsquo;s on our roadmap.
        Until an automatic process exists, you can contact us directly to
        ask for your data to be deleted and we&rsquo;ll do it manually.
      </P>

      <H2>5. Cookies</H2>
      <P>
        We don&rsquo;t set any cookies ourselves. Our login sessions are
        stored in your browser&rsquo;s <code>localStorage</code>, not
        cookies. When you pay, you&rsquo;re taken to Stripe&rsquo;s own
        checkout page, which sets its own cookies under Stripe&rsquo;s
        control — that&rsquo;s covered by{" "}
        <a
          href="https://stripe.com/gb/privacy"
          className="text-accent hover:underline"
        >
          Stripe&rsquo;s own privacy policy
        </a>
        , not this one.
      </P>

      <H2>6. Your rights</H2>
      <P>
        Under UK GDPR, you have the right to access, correct, delete, or
        export the personal data we hold about you, and to object to or
        restrict certain processing. Since we don&rsquo;t yet have
        self-service tools for most of this, contact us at{" "}
        <a href="mailto:info@playingnextapp.com" className="text-accent hover:underline">
          info@playingnextapp.com
        </a>{" "}
        and we&rsquo;ll action it manually. You also have the right to
        complain to the{" "}
        <a
          href="https://ico.org.uk/make-a-complaint/"
          className="text-accent hover:underline"
        >
          Information Commissioner&rsquo;s Office (ICO)
        </a>{" "}
        if you think we&rsquo;ve mishandled your data.
      </P>

      <H2>7. Age requirements</H2>
      <P>
        You must be at least 16 years old to submit a paid request or
        create a DJ account. DJ accounts additionally require being 18 or
        older, since Stripe Connect payouts require the account holder to
        be a legal adult.
      </P>

      <H2>8. Changes to this policy</H2>
      <P>
        If we make material changes to this policy, we&rsquo;ll update the
        date at the top of this page.
      </P>
    </LegalDoc>
  );
}
