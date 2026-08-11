"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { supabase } from "../../src/lib/supabase";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import Eyebrow from "@/src/components/ui/Eyebrow";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    /*
     * Clicking the reset-password email link redirects here with the
     * recovery token in the URL — the Supabase client picks that up
     * and establishes a session automatically on load, slightly after
     * this component first mounts. onAuthStateChange catches both the
     * PASSWORD_RECOVERY event and the case where getSession() already
     * has it by the time we check.
     */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasRecoverySession(true);
      }

      setCheckingSession(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setHasRecoverySession(true);
      }

      setCheckingSession(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const updatePassword = async (event?: React.FormEvent) => {
    event?.preventDefault();

    if (!password || !confirmPassword) {
      setErrorMessage("Please fill in both fields.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    if (!/[A-Z]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setErrorMessage(
        "Password must include an uppercase letter and a special character."
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords don't match.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    toast.success("Password updated. Please log in again.");
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-6 text-white">
        <p className="text-zinc-400">Loading...</p>
      </main>
    );
  }

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

          {hasRecoverySession ? (
            <>
              <h1 className="mt-2 text-h1">Set a new password</h1>
              <p className="mt-3 text-zinc-400">
                Choose a new password for your account.
              </p>

              <form onSubmit={updatePassword} className="mt-8 space-y-4">
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="New password"
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />

                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />

                <p className="text-xs text-zinc-500">
                  At least 8 characters, with an uppercase letter and a
                  special character.
                </p>

                {errorMessage && (
                  <div className="rounded-control border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                    {errorMessage}
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Saving..." : "Save New Password"}
                </Button>
              </form>
            </>
          ) : (
            <>
              <h1 className="mt-2 text-h1">Link expired</h1>
              <p className="mt-3 text-zinc-400">
                This password reset link is invalid or has expired. Request a
                new one below.
              </p>

              <Link
                href="/forgot-password"
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-control bg-white px-6 font-semibold text-black transition hover:bg-zinc-200"
              >
                Request New Link
              </Link>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
