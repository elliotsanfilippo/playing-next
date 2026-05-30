"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../src/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/dj/dashboard");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900 p-8">
        <p className="text-sm text-zinc-400">Playing Next</p>

        <h1 className="mt-2 text-4xl font-bold">DJ Login</h1>

        <p className="mt-3 text-zinc-400">
          Log in to manage your requests.
        </p>

        <div className="mt-8 space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-4 text-white outline-none"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-4 text-white outline-none"
          />

          <button
            onClick={login}
            className="w-full rounded-2xl bg-white px-6 py-4 font-semibold text-black"
          >
            Log In
          </button>
          <p className="mt-6 text-center text-sm text-zinc-400">
  Don't have an account?{" "}
  <a
    href="/signup"
    className="font-semibold text-white underline underline-offset-4"
  >
    Sign Up
  </a>
</p>
        </div>
      </div>
    </main>
  );
}