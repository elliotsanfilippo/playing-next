"use client";

import { useState } from "react";
import { supabase } from "../../src/lib/supabase";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const signUp = async () => {
    const { data, error } = await supabase.auth.signUp({
  email,
  password,
});

    if (error) {
      alert(error.message);
      return;
    }

if (data.user) {
  const slug = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const { error: profileError } = await supabase
  .from("dj_profiles")
  .insert({
    user_id: data.user.id,
    dj_name: "New DJ",
    slug,
    bio: "",
    genres: [],
    request_price: 500,
    request_status: "taking_requests",
  });

if (profileError) {
  console.log("Profile create error:", profileError);
  alert(profileError.message);
  return;
}
}

    alert("Account created. Check your email to confirm your account.");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900 p-8">
        <p className="text-sm text-zinc-400">Playing Next</p>

        <h1 className="mt-2 text-4xl font-bold">Create DJ Account</h1>

        <p className="mt-3 text-zinc-400">
          Sign up to manage requests and share your QR code.
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
            onClick={signUp}
            className="w-full rounded-2xl bg-white px-6 py-4 font-semibold text-black"
          >
            Create Account
          </button>
        </div>
      </div>
    </main>
  );
}