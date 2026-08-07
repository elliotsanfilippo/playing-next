"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "../../../src/lib/supabase";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import { Input, Textarea } from "@/src/components/ui/Input";
import Eyebrow from "@/src/components/ui/Eyebrow";

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

const fieldLabel = "text-sm text-zinc-400";

function DJSettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const cameFromOnboarding = searchParams.get("from") === "onboarding";
  const [profile, setProfile] = useState<DJProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const [djName, setDjName] = useState("");
  const [genres, setGenres] = useState("");
  const [bio, setBio] = useState("");
  const [requestPrice, setRequestPrice] = useState("5");
  const [shoutoutPrice, setShoutoutPrice] = useState("8");
  const [saving, setSaving] = useState(false);

  const fetchProfile = async () => {
    setLoadingProfile(true);

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
      setLoadingProfile(false);
      return;
    }

    setProfile(data);
    setDjName(data.dj_name || "");
    setGenres(
      Array.isArray(data.genres) ? data.genres.join(", ") : data.genres || ""
    );
    setBio(data.bio || "");
    setRequestPrice(((data.request_price || 500) / 100).toString());
    setShoutoutPrice(((data.shoutout_price || 800) / 100).toString());
    setProfileImageUrl(data.profile_image_url || "");
    setLoadingProfile(false);
  };

  const saveProfile = async () => {
    if (!profile) return;

    const priceInPence = Math.round(Number(requestPrice) * 100);
    const shoutoutPriceInPence = Math.round(Number(shoutoutPrice) * 100);

    if (!djName.trim()) {
      toast.error("Please enter a DJ name.");
      return;
    }

    if (!Number.isFinite(priceInPence) || priceInPence <= 0) {
      toast.error("Please enter a valid request price.");
      return;
    }

    if (!Number.isFinite(shoutoutPriceInPence) || shoutoutPriceInPence <= 0) {
      toast.error("Please enter a valid Song + Message price.");
      return;
    }

    if (shoutoutPriceInPence <= priceInPence) {
      toast.error(
        "Song + Message price must be higher than the standard request price."
      );
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("dj_profiles")
      .update({
        dj_name: djName.trim(),
        genres: genres
          .split(",")
          .map((genre) => genre.trim())
          .filter(Boolean),
        bio,
        request_price: priceInPence,
        shoutout_price: shoutoutPriceInPence,
      })
      .eq("id", profile.id);

    setSaving(false);

    if (error) {
      console.log("Profile save error:", error);
      toast.error(error.message);
      return;
    }

    toast.success("Profile saved");
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
      toast.error(uploadError.message);
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
      toast.error(error.message);
      return;
    }

    setProfileImageUrl(imageUrl);
    toast.success("Profile image uploaded");
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (loadingProfile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-6 text-white">
        <Card variant="elevated" className="p-8 text-center">
          <p className="text-sm text-zinc-400">Playing Next</p>
          <h1 className="mt-3 text-h2">Loading settings...</h1>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-canvas p-5 text-white sm:p-6">
      <section className="mx-auto max-w-3xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Eyebrow tone="accent">Playing Next</Eyebrow>
            <h1 className="mt-2 text-h1">DJ Settings</h1>
          </div>

          <Button
            variant="secondary"
            size="sm"
            className="rounded-full"
            onClick={() => router.push("/dj/dashboard")}
          >
            {cameFromOnboarding ? "Back to Onboarding" : "Back to Dashboard"}
          </Button>
        </div>

        <Card variant="elevated" className="p-5 sm:p-6">
          <div className="space-y-6">
            <div>
              <label className={fieldLabel}>Profile Image</label>

              <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
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

                <label className="inline-flex w-full cursor-pointer justify-center rounded-control bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 sm:w-auto">
                  {uploadingImage
                    ? "Uploading..."
                    : profileImageUrl
                      ? "Change Image"
                      : "Upload Image"}

                  <input
                    type="file"
                    accept="image/*"
                    onChange={uploadProfileImage}
                    disabled={uploadingImage}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div>
              <label className={fieldLabel}>DJ Name</label>
              <Input
                value={djName}
                onChange={(event) => setDjName(event.target.value)}
                className="mt-2 h-auto py-4"
              />
            </div>

            <div>
              <label className={fieldLabel}>Genres</label>
              <Input
                value={genres}
                onChange={(event) => setGenres(event.target.value)}
                placeholder="House, UK Garage, Tech House"
                className="mt-2 h-auto py-4"
              />
              <p className="mt-2 text-xs text-zinc-500">
                Separate genres with commas.
              </p>
            </div>

            <div>
              <label className={fieldLabel}>Bio</label>
              <Textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder="Tell guests what kind of music you play..."
                rows={5}
                className="mt-2"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={fieldLabel}>Request Price (£)</label>
                <Input
                  type="number"
                  min="1"
                  step="0.5"
                  value={requestPrice}
                  onChange={(event) => setRequestPrice(event.target.value)}
                  className="mt-2 h-auto py-4"
                />
              </div>

              <div>
                <label className={fieldLabel}>
                  Song + Message Price (£)
                </label>

                <Input
                  type="number"
                  min="1"
                  step="0.5"
                  value={shoutoutPrice}
                  onChange={(event) => setShoutoutPrice(event.target.value)}
                  className="mt-2 h-auto py-4"
                />
              </div>
            </div>

            <div className="rounded-card border border-white/10 bg-black/20 p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Current Plan</p>
                  <h3 className="mt-1 text-2xl font-semibold">Free</h3>
                  <p className="mt-3 text-sm text-zinc-400">
                    15% platform fee per accepted request.
                  </p>
                </div>

                <div className="rounded-full bg-accent/20 px-4 py-2 text-sm font-semibold text-accent">
                  Active
                </div>
              </div>

              <div className="mt-6 rounded-control border border-white/10 bg-zinc-900 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="font-semibold">Pro</h4>
                    <p className="mt-1 text-sm text-zinc-400">
                      £19/month · 0% platform fee
                    </p>
                  </div>

                  <Button variant="secondary" size="sm" disabled>
                    Coming Soon
                  </Button>
                </div>
              </div>
            </div>

            <Button
              type="button"
              onClick={saveProfile}
              disabled={saving}
              className="w-full"
            >
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </Card>
      </section>
    </main>
  );
}

export default function DJSettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-canvas p-6 text-white">
          <Card variant="elevated" className="p-8 text-center">
            <p className="text-sm text-zinc-400">Playing Next</p>
            <h1 className="mt-3 text-h2">Loading settings...</h1>
          </Card>
        </main>
      }
    >
      <DJSettingsPageContent />
    </Suspense>
  );
}
