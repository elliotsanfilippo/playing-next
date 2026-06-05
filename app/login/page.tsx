"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../src/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async (event?: React.FormEvent) => {
  event?.preventDefault();
    if (!email || !password) {
      alert("Please enter your email and password.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

setLoading(false);

if (error) {
  return;
}

setTimeout(() => {

  window.location.href = "/dj/dashboard";

}, 300);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-5 text-white sm:p-6">
      <div className="relative z-50 w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900 p-6 sm:p-8">
        <p className="text-sm text-zinc-400">Playing Next</p>

        <h1 className="mt-2 text-4xl font-bold">DJ Login</h1>

        <p className="mt-3 text-zinc-400">
          Log in to manage your requests.
        </p>

        <form onSubmit={login} className="mt-8 space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-4 text-white outline-none placeholder:text-zinc-500"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-4 text-white outline-none placeholder:text-zinc-500"
          />

          <button
  type="submit"
  disabled={loading}
  className="relative z-50 w-full rounded-2xl bg-white px-6 py-4 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
>
  {loading ? "Logging In..." : "Log In"}
</button>

          <p className="pt-4 text-center text-sm text-zinc-400">
            Don&apos;t have an account?{" "}
            <a
              href="/signup"
              className="font-semibold text-white underline underline-offset-4"
            >
              Sign Up
            </a>
          </p>
        </form>
      </div>
    </main>
  );
}