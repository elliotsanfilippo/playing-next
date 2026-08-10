"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase, REMEMBER_ME_KEY } from "../../src/lib/supabase";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import Eyebrow from "@/src/components/ui/Eyebrow";

export default function LoginPage() {
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
     * Read by the Supabase client's storage adapter on every read/write,
     * so it must be set before signInWithPassword actually writes the
     * session — not after.
     */
    window.localStorage.setItem(
      REMEMBER_ME_KEY,
      rememberMe ? "true" : "false"
    );

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      let message = error.message;

      if (message.toLowerCase().includes("email not confirmed")) {
        message = "Please verify your email before signing in.";
      } else if (
        message.toLowerCase().includes("invalid login credentials")
      ) {
        message = "Incorrect email or password.";
      }

      setErrorMessage(message);
      return;
    }

    window.location.assign(`${window.location.origin}/dj/dashboard`);
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
          <h1 className="mt-2 text-h1">Welcome back</h1>
          <p className="mt-3 text-zinc-400">
            Log in to manage your requests.
          </p>

          <form onSubmit={login} className="mt-8 space-y-4">
            <Input
              type="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <Input
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-transparent accent-accent-strong"
              />
              Remember me
            </label>

            {errorMessage && (
              <div className="rounded-control border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                {errorMessage}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Logging In..." : "Log In"}
            </Button>

            <p className="pt-4 text-center text-sm text-zinc-400">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-semibold text-white underline underline-offset-4"
              >
                Sign Up
              </Link>
            </p>
          </form>
        </Card>
      </div>
    </main>
  );
}
