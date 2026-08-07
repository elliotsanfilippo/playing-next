"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../src/lib/supabase";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
const [errorMessage, setErrorMessage] = useState("");
const [successMessage, setSuccessMessage] = useState("");
  const signUp = async (event?: React.FormEvent) => {
  event?.preventDefault();
    if (!email || !password) {
      setErrorMessage(
  "Please enter your email and password."
);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      let message = error.message;

if (
  message.toLowerCase().includes("rate limit")
) {
  message =
    "Too many verification emails have been requested. Please wait a few minutes before trying again.";
} else if (
  message.toLowerCase().includes("already")
) {
  message =
    "An account already exists with this email address.";
}

setErrorMessage(message);
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
          shoutout_price: 800,
          request_status: "taking_requests",
        });

      if (profileError) {
        setLoading(false);
        console.log("Profile create error:", profileError);
        alert(profileError.message);
        return;
      }
    }

    setLoading(false);
    setSuccessMessage(
  "Account created! Please check your email to verify your account before signing in."
);

setEmail("");
setPassword("");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-5 text-white sm:p-6">
      <div className="relative z-50 w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900 p-6 sm:p-8">
        <p className="text-sm text-zinc-400">Playing Next</p>

        <h1 className="mt-2 text-4xl font-bold">
          Create DJ Account
        </h1>

        <p className="mt-3 text-zinc-400">
          Sign up to manage requests and share your QR code.
        </p>

        <form onSubmit={signUp} className="mt-8 space-y-4">
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
{errorMessage && (
  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
    {errorMessage}
  </div>
)}

{successMessage && (
  <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-300">
    {successMessage}
  </div>
)}
          <button
  type="submit"
  disabled={loading}
  className="relative z-50 w-full rounded-2xl bg-white px-6 py-4 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
>
  {loading ? "Creating Account..." : "Create Account"}
</button>

          <p className="pt-4 text-center text-sm text-zinc-400">
            Already have an account?{" "}
            <a
  href="/login"
  className="font-semibold text-white underline underline-offset-4"
>
  Log In
</a>
          </p>
        </form>
      </div>
    </main>
  );
}