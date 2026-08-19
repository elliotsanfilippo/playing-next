"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { supabase } from "../../src/lib/supabase";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import Eyebrow from "@/src/components/ui/Eyebrow";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const signUp = async (event?: React.FormEvent) => {
    event?.preventDefault();

    if (!email || !password) {
      setErrorMessage("Please enter your email and password.");
      return;
    }

    if (!agreedToTerms) {
      setErrorMessage("Please agree to the DJ Terms and Privacy Policy to continue.");
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

    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      let message = error.message;

      if (message.toLowerCase().includes("rate limit")) {
        message =
          "Too many verification emails have been requested. Please wait a few minutes before trying again.";
      } else if (message.toLowerCase().includes("already")) {
        message = "An account already exists with this email address.";
      }

      setErrorMessage(message);
      return;
    }

    if (data.user) {
      const response = await fetch("/api/dj/bootstrap-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: data.user.id, email }),
      });

      if (!response.ok) {
        setLoading(false);
        const body = await response.json().catch(() => ({}));
        console.log("Profile create error:", body);
        toast.error(body.error || "Unable to set up your DJ profile.");
        return;
      }
    }

    setLoading(false);
    setSuccessMessage(
      "Account created! Please check your email to verify your account before signing in. If you don't see it within a few minutes, check your spam or junk folder."
    );

    setEmail("");
    setPassword("");
    setAgreedToTerms(false);
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
          <h1 className="mt-2 text-h1">Create your account</h1>
          <p className="mt-3 text-zinc-400">
            Sign up to manage requests and share your QR code.
          </p>

          <form onSubmit={signUp} className="mt-8 space-y-4">
            <Input
              type="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <Input
              type="password"
              autoComplete="new-password"
              placeholder="Password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <p className="text-xs text-zinc-500">
              At least 8 characters, with an uppercase letter and a special
              character.
            </p>

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

            <label className="flex items-start gap-2 text-xs text-zinc-500">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(event) => setAgreedToTerms(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-transparent accent-accent-strong"
              />
              <span>
                I agree to the{" "}
                <Link href="/legal/dj-terms" className="underline underline-offset-4 hover:text-zinc-300">
                  DJ Terms
                </Link>{" "}
                and{" "}
                <Link href="/legal/privacy" className="underline underline-offset-4 hover:text-zinc-300">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            <Button
              type="submit"
              disabled={loading || !agreedToTerms}
              className="w-full"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </Button>

            <p className="pt-2 text-center text-sm text-zinc-400">
              Already have an account?{" "}
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
