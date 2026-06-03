"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../src/lib/supabase";

type DJProfile = {
   profile_image_url: string | null;
  id: string;
  dj_name: string;
  slug: string;
  request_status: string;
  bio: string | null;
  genres: string[] | string | null;
  request_price: number | null;
  shoutout_price: number | null;
};

export default function DJSettingsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<DJProfile | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [djName, setDjName] = useState("");
  const [genres, setGenres] = useState("");
  const [bio, setBio] = useState("");
  const [requestPrice, setRequestPrice] = useState("5");
  const [shoutoutPrice, setShoutoutPrice] = useState("8");
  const [saving, setSaving] = useState(false);

  const fetchProfile = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("dj_profiles")
      .select("*")
      .eq("user_id", session.user.id)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      console.log("Profile load error:", error);
      return;
    }

    setProfile(data);
setDjName(data.dj_name || "");
setGenres(
  Array.isArray(data.genres)
    ? data.genres.join(", ")
    : data.genres || ""
);
setBio(data.bio || "");
setRequestPrice(
  ((data.request_price || 500) / 100).toString()
);
setShoutoutPrice(
  ((data.shoutout_price || 800) / 100).toString()
);
setProfileImageUrl(
  data.profile_image_url || ""
);
};
  const saveProfile = async () => {
    if (!profile) return;

    setSaving(true);

    const priceInPence = Math.round(Number(requestPrice) * 100);
    const shoutoutPriceInPence = Math.round(Number(shoutoutPrice) * 100);

if (shoutoutPriceInPence <= priceInPence) {
  alert("Song + Message price must be higher than the standard request price.");
  setSaving(false);
  return;
}
    const { error } = await supabase
      .from("dj_profiles")
      .update({
        dj_name: djName,
        genres: genres
  .split(",")
  .map((genre) => genre.trim())
  .filter(Boolean),
        bio,
        request_price: priceInPence, shoutout_price: shoutoutPriceInPence,
      })
      .eq("id", profile.id);

    setSaving(false);

    if (error) {
      console.log("Profile save error:", error);
      alert(error.message);
      return;
    }

    alert("Profile saved");
    await fetchProfile();
  };
const uploadProfileImage = async (
  event: React.ChangeEvent<HTMLInputElement>
) => {
  const file = event.target.files?.[0];

  if (!file || !profile) return;

  setUploadingImage(true);

  const fileName = `${profile.id}-${Date.now()}`;

  const { error: uploadError } = await supabase.storage
    .from("dj-profile-images")
    .upload(fileName, file, {
      upsert: true,
    });

  if (uploadError) {
    setUploadingImage(false);
    alert(uploadError.message);
    return;
  }

  const { data } = supabase.storage
    .from("dj-profile-images")
    .getPublicUrl(fileName);

  const imageUrl = data.publicUrl;

  const { error } = await supabase
    .from("dj_profiles")
    .update({
      profile_image_url: imageUrl,
    })
    .eq("id", profile.id);

  setUploadingImage(false);

  if (error) {
    alert(error.message);
    return;
  }

  setProfileImageUrl(imageUrl);
  alert("Profile image uploaded");
};
  useEffect(() => {
    fetchProfile();
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <section className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-400">Playing Next</p>
            <h1 className="mt-2 text-4xl font-bold">DJ Settings</h1>
          </div>

          <button
            onClick={() => router.push("/dj/dashboard")}
            className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold"
          >
            Back to Dashboard
          </button>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-900 p-6">
          <div className="space-y-6">
            <div>
  <label className="text-sm text-zinc-400">Profile Image</label>

  <div className="mt-3 flex items-center gap-4">
    {profileImageUrl ? (
      <img
        src={profileImageUrl}
        alt="DJ profile"
        className="h-24 w-24 rounded-full object-cover"
      />
    ) : (
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-800 text-sm text-zinc-500">
        No image
      </div>
    )}

    <label className="inline-flex cursor-pointer rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">
      {profileImageUrl ? "Change Image" : "Upload Image"}

      <input
        type="file"
        accept="image/*"
        onChange={uploadProfileImage}
        disabled={uploadingImage}
        className="hidden"
      />
    </label>
  </div>

  {uploadingImage && (
    <p className="mt-2 text-sm text-zinc-400">Uploading...</p>
  )}
</div>
            <div>
              <label className="text-sm text-zinc-400">DJ Name</label>
              <input
                value={djName}
                onChange={(event) => setDjName(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-4 text-white outline-none"
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400">Genres</label>
              <input
                value={genres}
                onChange={(event) => setGenres(event.target.value)}
                placeholder="House • UK Garage • Tech House"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-4 text-white outline-none"
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400">Bio</label>
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder="Tell guests what kind of music you play..."
                rows={5}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-4 text-white outline-none"
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400">Request Price (£)</label>
              <input
                type="number"
                min="1"
                step="0.5"
                value={requestPrice}
                onChange={(event) => setRequestPrice(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-4 text-white outline-none"
              />
            </div>
<div>
  <label className="text-sm text-zinc-400">
    Song + Message Price (£)
  </label>

  <input
    type="number"
    min="1"
    step="0.5"
    value={shoutoutPrice}
    onChange={(event) =>
      setShoutoutPrice(event.target.value)
    }
    className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-4 text-white outline-none"
  />
</div>
            <button
              onClick={saveProfile}
              disabled={saving}
              className="w-full rounded-2xl bg-white px-6 py-4 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}