"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../src/lib/supabase";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import Eyebrow from "@/src/components/ui/Eyebrow";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const sendResetEmail = async (event?: React.FormEvent) => {
    event?.preventDefault();

    if (!email) {
      setErrorMessage("Please enter your email.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    /*
     * Supabase doesn't reveal whether the email actually exists, to
     * avoid leaking which addresses have accounts — so this message
     * shows the same way either way, matching that behaviour rather
     * than contradicting it.
     */
    setSuccessMessage(
      "If an account exists for that email, we've sent a link to reset your password. Check your spam or junk folder if you don't see it within a few minutes."
    );

    setEmail("");
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas p-5 text-white sm:p-6">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-160px] top-[-160px] h-[420px] w-[420px] rounded-full bg-green-500/10 blur-[140px]" />
        <div className="absolute right-[-220px] bottom-[-160px] h-[420px] w-[420px] rounded-full bg-green-500/10 blur-[140px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          <img src="/logo.svg" alt="Playing Next" className="h-10 w-10" />
          <span className="text-base font-bold tracking-tight">
            Playing Next
          </span>
        </Link>

        <Card variant="elevated" className="p-6 sm:p-8">
          <Eyebrow tone="accent">DJ account</Eyebrow>
          <h1 className="mt-2 text-h1">Reset your password</h1>
          <p className="mt-3 text-zinc-400">
            Enter your account email and we&apos;ll send you a link to reset
            it.
          </p>

          <form onSubmit={sendResetEmail} className="mt-8 space-y-4">
            <Input
              type="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            {errorMessage && (
              <div className="rounded-control border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="rounded-control border border-accent/20 bg-accent/10 p-4 text-sm text-accent">
                {successMessage}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>

            <p className="pt-2 text-center text-sm text-zinc-400">
              Remembered it?{" "}
              <Link
                href="/login"
                className="font-semibold text-white underline underline-offset-4"
              >
                Log In
              </Link>
            </p>
          </form>
        </Card>
      </div>
    </main>
  );
}
