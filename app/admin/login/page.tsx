"use client";

import { useState } from "react";
import { supabase, REMEMBER_ME_KEY } from "@/src/lib/supabase";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const login = async (event?: React.FormEvent) => {
    event?.preventDefault();

    if (!email || !password) {
      setErrorMessage("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    /*
     * Written before signing in, because the storage adapter in
     * src/lib/supabase.ts reads this flag at the moment the session is
     * persisted. Setting it afterwards would put the first session in
     * the wrong store.
     *
     * Checked, the session goes to localStorage and survives closing
     * the app; unchecked, it goes to sessionStorage and dies with it.
     * Either way this only chooses WHERE the session lives. No password
     * is stored, no long-lived token is minted, the access token is
     * still a 60-minute one refreshed by supabase-js, and every
     * /api/admin/* call is still authorised server-side by
     * getAdminUser() against the email allowlist.
     *
     * The Admin previously set nothing here and inherited whatever the
     * DJ login last wrote, so unticking the box at /login silently made
     * the Admin session tab-scoped too.
     */
    window.localStorage.setItem(
      REMEMBER_ME_KEY,
      rememberMe ? "true" : "false"
    );

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      setErrorMessage(
        error.message.toLowerCase().includes("invalid login credentials")
          ? "Incorrect email or password."
          : error.message
      );
      return;
    }

    /*
     * A successful sign-in only proves this is a real app login, not
     * that it is on the admin allowlist. Checked here rather than
     * letting /admin render its 404, so a valid-but-wrong account gets a
     * sentence instead of what looks like a broken page.
     */
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setLoading(false);
      setErrorMessage("Something went wrong. Please try again.");
      return;
    }

    const check = await fetch("/api/admin/djs", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (check.status === 403) {
      await supabase.auth.signOut();
      setLoading(false);
      setErrorMessage("This account doesn't have admin access.");
      return;
    }

    window.location.assign(`${window.location.origin}/admin`);
  };

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-canvas px-5 text-white"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 1.5rem)",
        paddingBottom: "max(env(safe-area-inset-bottom), 1.5rem)",
      }}
    >
      {/* One quiet glow rather than the pair the page had. Two corner
          glows on a phone read as decoration competing with a four-field
          form. */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-green-500/[0.07] blur-[140px]"
      />

      <div className="relative z-10 w-full max-w-sm">
        {/*
          Deliberately not a link. This is the entry point of a
          standalone Home Screen app, and a wordmark that navigates to
          the public marketing site drops you outside the app's scope
          with no obvious way back.
        */}
        <div className="mb-9 flex flex-col items-center gap-3">
          <img
            src="/icons/admin-icon-192.png"
            alt=""
            aria-hidden
            className="h-12 w-12 rounded-[0.9rem]"
          />
          <div className="text-center">
            <p className="text-base font-bold tracking-tight">Playing Next</p>
            <p className="mt-0.5 font-mono text-[0.68rem] uppercase tracking-[0.22em] text-accent">
              Admin
            </p>
          </div>
        </div>

        <Card variant="elevated" className="p-6 sm:p-7">
          <form onSubmit={login} className="space-y-3.5">
            <Input
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="Email"
              aria-label="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <Input
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              aria-label="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 shrink-0 rounded border-white/20 bg-transparent accent-accent-strong"
              />
              Remember me on this device
            </label>

            {errorMessage && (
              <div
                role="alert"
                className="rounded-control border border-status-declined-surface/20 bg-status-declined-surface/10 p-3.5 text-sm text-status-declined"
              >
                {errorMessage}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </Card>

        <p className="mt-6 text-center text-xs leading-relaxed text-text-muted">
          Private access. This area is for Playing Next staff only and is
          not part of the DJ or guest experience.
        </p>
      </div>
    </main>
  );
}
