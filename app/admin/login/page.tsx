"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/src/lib/supabase";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import Eyebrow from "@/src/components/ui/Eyebrow";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

    const { error } = await supabase.auth.signInWithPassword({ email, password });

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
     * that it's on the admin allowlist — checked here (rather than
     * just redirecting to /admin and letting it 404) so a wrong-but-
     * valid account gets a clear message instead of landing on what
     * looks like a random broken page.
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas p-5 text-white sm:p-6">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-160px] top-[-160px] h-[420px] w-[420px] rounded-full bg-green-500/10 blur-[140px]" />
        <div className="absolute right-[-220px] bottom-[-160px] h-[420px] w-[420px] rounded-full bg-green-500/10 blur-[140px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          <img src="/logo.svg" alt="Playing Next" className="h-10 w-10" />
          <span className="text-base font-bold tracking-tight">Playing Next</span>
        </Link>

        <Card variant="elevated" className="p-6 sm:p-8">
          <Eyebrow tone="accent">Admin</Eyebrow>
          <h1 className="mt-2 text-h1">Admin sign in</h1>
          <p className="mt-3 text-zinc-400">Restricted access.</p>

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

            {errorMessage && (
              <div className="rounded-control border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                {errorMessage}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
