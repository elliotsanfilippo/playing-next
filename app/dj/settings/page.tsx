"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "../../../src/lib/supabase";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import { Input, Textarea } from "@/src/components/ui/Input";
import Eyebrow from "@/src/components/ui/Eyebrow";
import {
  getNotificationPreferences,
  isBrowserNotificationSupported,
  requestNotificationPermission,
  setNotificationPreferences,
  type NotificationPreferences,
} from "@/src/lib/notifications";
import {
  getExistingPushSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/src/lib/push";

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
  plan: string | null;
  stripe_subscription_status: string | null;
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
  const [subscribing, setSubscribing] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [notificationPrefs, setNotificationPrefsState] =
    useState<NotificationPreferences>({ sound: true, browser: false });
  const [pushEnabled, setPushEnabled] = useState(false);
  const [togglingPush, setTogglingPush] = useState(false);

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

  const getAccessToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? null;
  };

  const upgradeToPro = async () => {
    if (subscribing) return;

    setSubscribing(true);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/stripe/subscribe", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = await response.json();

      if (!response.ok || !result.url) {
        throw new Error(result.error || "Unable to start the Pro upgrade.");
      }

      window.location.href = result.url;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to start the Pro upgrade."
      );
      setSubscribing(false);
    }
  };

  const manageBilling = async () => {
    if (openingPortal) return;

    setOpeningPortal(true);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/stripe/billing-portal", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = await response.json();

      if (!response.ok || !result.url) {
        throw new Error(result.error || "Unable to open billing.");
      }

      window.location.href = result.url;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to open billing."
      );
      setOpeningPortal(false);
    }
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
    setNotificationPrefsState(getNotificationPreferences());

    getExistingPushSubscription().then((subscription) => {
      setPushEnabled(!!subscription);
    });

    if (searchParams.get("pro") === "success") {
      toast.success("Welcome to Pro! This can take a few seconds to appear below.");
    }
  }, []);

  const toggleSound = () => {
    const next = { ...notificationPrefs, sound: !notificationPrefs.sound };
    setNotificationPrefsState(next);
    setNotificationPreferences(next);
  };

  const toggleBrowserNotifications = async () => {
    if (notificationPrefs.browser) {
      const next = { ...notificationPrefs, browser: false };
      setNotificationPrefsState(next);
      setNotificationPreferences(next);
      return;
    }

    if (!isBrowserNotificationSupported()) {
      toast.error("Your browser doesn't support notifications.");
      return;
    }

    const granted = await requestNotificationPermission();

    if (!granted) {
      toast.error(
        "Notifications are blocked. Enable them in your browser's site settings."
      );
      return;
    }

    const next = { ...notificationPrefs, browser: true };
    setNotificationPrefsState(next);
    setNotificationPreferences(next);
  };

  const togglePushNotifications = async () => {
    if (!isPushSupported()) {
      toast.error("Push notifications aren't supported on this device.");
      return;
    }

    setTogglingPush(true);

    try {
      if (pushEnabled) {
        await unsubscribeFromPush();
        setPushEnabled(false);
      } else {
        await subscribeToPush();
        setPushEnabled(true);
        toast.success("Push notifications enabled.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setTogglingPush(false);
    }
  };

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

            {(() => {
              const isPro = profile?.plan === "pro";
              const subscriptionStatus = profile?.stripe_subscription_status;
              const isActivePro = isPro && subscriptionStatus === "active";
              const hasPaymentIssue =
                isPro && subscriptionStatus && subscriptionStatus !== "active";

              return (
                <div className="rounded-card border border-white/10 bg-black/20 p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm text-zinc-400">Current Plan</p>
                      <h3 className="mt-1 text-2xl font-semibold">
                        {isPro ? "Pro" : "Free"}
                      </h3>
                      <p className="mt-3 text-sm text-zinc-400">
                        {isActivePro
                          ? "0% platform fee per accepted request."
                          : "15% platform fee per accepted request."}
                      </p>
                      {hasPaymentIssue && (
                        <p className="mt-2 text-sm text-amber-400">
                          There&apos;s a problem with your Pro payment — you&apos;re
                          being charged the Free rate (15%) until it&apos;s
                          resolved.
                        </p>
                      )}
                    </div>

                    <div
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        hasPaymentIssue
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-accent/20 text-accent"
                      }`}
                    >
                      {hasPaymentIssue ? "Payment issue" : "Active"}
                    </div>
                  </div>

                  {isPro ? (
                    <div className="mt-6 rounded-control border border-white/10 bg-zinc-900 p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h4 className="font-semibold">Billing</h4>
                          <p className="mt-1 text-sm text-zinc-400">
                            Manage your card, invoices, or cancel Pro.
                          </p>
                        </div>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={manageBilling}
                          disabled={openingPortal}
                        >
                          {openingPortal ? "Opening..." : "Manage Billing"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 rounded-control border border-white/10 bg-zinc-900 p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h4 className="font-semibold">Pro</h4>
                          <p className="mt-1 text-sm text-zinc-400">
                            £14.99/month · 0% platform fee
                          </p>
                        </div>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={upgradeToPro}
                          disabled={subscribing}
                        >
                          {subscribing ? "Opening..." : "Upgrade to Pro"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="rounded-card border border-white/10 bg-black/20 p-5 sm:p-6">
              <p className="text-sm text-zinc-400">Notifications</p>
              <h3 className="mt-1 text-lg font-semibold">
                New request alerts
              </h3>
              <p className="mt-2 text-sm text-zinc-500">
                These are per-device — set them up on whatever you're
                running the dashboard on tonight.
              </p>

              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between rounded-control border border-white/10 bg-zinc-900 p-4">
                  <div>
                    <p className="font-semibold">Sound</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      Plays a short chime when a new request comes in.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={toggleSound}
                    className={`inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold transition ${
                      notificationPrefs.sound
                        ? "bg-accent-strong text-black"
                        : "border border-white/10 bg-white/5 text-zinc-400"
                    }`}
                  >
                    {notificationPrefs.sound ? "On" : "Off"}
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-control border border-white/10 bg-zinc-900 p-4">
                  <div>
                    <p className="font-semibold">Browser notifications</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      Alerts you even if this tab isn&apos;t focused.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={toggleBrowserNotifications}
                    className={`inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold transition ${
                      notificationPrefs.browser
                        ? "bg-accent-strong text-black"
                        : "border border-white/10 bg-white/5 text-zinc-400"
                    }`}
                  >
                    {notificationPrefs.browser ? "On" : "Off"}
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-control border border-white/10 bg-zinc-900 p-4">
                  <div>
                    <p className="font-semibold">Push notifications</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      Alerts you even if this tab or browser is closed.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={togglePushNotifications}
                    disabled={togglingPush}
                    className={`inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold transition disabled:opacity-50 ${
                      pushEnabled
                        ? "bg-accent-strong text-black"
                        : "border border-white/10 bg-white/5 text-zinc-400"
                    }`}
                  >
                    {pushEnabled ? "On" : "Off"}
                  </button>
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
