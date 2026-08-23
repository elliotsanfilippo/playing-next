"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Cropper, { type Area } from "react-easy-crop";
import { Check, Copy, Lock } from "lucide-react";
import { supabase } from "../../../src/lib/supabase";
import { getCroppedImageBlob } from "@/src/lib/cropImage";
import {
  FREE_PLATFORM_FEE_BPS,
  PRO_MONTHLY_PRICE_GBP,
  PRO_PLATFORM_FEE_BPS,
} from "@/src/lib/pricing";
import {
  LIMITS,
  parseGenres,
  penceToPounds,
  poundsToPence,
  previewPrice,
  validateSettings,
  type FieldErrors,
} from "@/src/lib/settingsValidation";
import Button from "@/src/components/ui/Button";
import { Input, Textarea } from "@/src/components/ui/Input";
import Skeleton from "@/src/components/ui/Skeleton";
import MoneyValue from "@/src/components/product/MoneyValue";
import Field from "./components/Field";
import Switch from "./components/Switch";
import Section from "./components/Section";
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

/*
 * Settings is where a DJ configures the night before it starts. The
 * dashboard owns anything they touch mid-set — pausing, auto-close,
 * the queue — and Events Mode owns per-event price overrides. Nothing
 * here duplicates either.
 *
 * The page holds no business rules. Limits, parsing and error copy all
 * come from src/lib/settingsValidation.ts, which /api/dj/settings runs
 * as the authority. What the DJ sees while typing and what the server
 * will accept are the same code, so they cannot drift.
 */

type DJProfile = {
  id: string;
  slug: string;
  profile_image_url: string | null;
  plan: string | null;
  stripe_subscription_status: string | null;
  stripe_connected: boolean | null;
};

/** The editable form, as strings, exactly as the inputs hold it. */
type FormState = {
  djName: string;
  genres: string;
  bio: string;
  requestPrice: string;
  messagePrice: string;
  maxPending: string;
  maxQueue: string;
  showInDiscovery: boolean;
};

/** Whole numbers only. Sends null on anything else so the shared
 *  validator produces the message rather than this file guessing. */
const parseCount = (input: string): number | null =>
  /^\d{1,3}$/.test(input.trim()) ? Number(input.trim()) : null;

const toPayload = (form: FormState) => ({
  djName: form.djName,
  bio: form.bio,
  genres: parseGenres(form.genres),
  requestPrice: poundsToPence(form.requestPrice),
  messagePrice: poundsToPence(form.messagePrice),
  maxPending: parseCount(form.maxPending),
  maxQueue: parseCount(form.maxQueue),
  showInDiscovery: form.showInDiscovery,
});

function DJSettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cameFromOnboarding = searchParams.get("from") === "onboarding";

  const [profile, setProfile] = useState<DJProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [form, setForm] = useState<FormState | null>(null);
  /** The last state the server confirmed. Dirty state is measured
   *  against this, and a failed save leaves it untouched. */
  const [baseline, setBaseline] = useState<FormState | null>(null);

  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState("");

  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const [subscribing, setSubscribing] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [qrBoxAvailable, setQrBoxAvailable] = useState(false);
  const [copied, setCopied] = useState(false);

  const [notificationPrefs, setNotificationPrefsState] =
    useState<NotificationPreferences>({ sound: true, browser: false });
  const [pushEnabled, setPushEnabled] = useState(false);
  const [togglingPush, setTogglingPush] = useState(false);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setJustSaved(false);
    /* Clear this field's error as soon as it is touched. Leaving it
       there while the DJ types makes the page argue with them. */
    setFieldErrors((current) =>
      current[key as keyof FieldErrors] ? { ...current, [key]: undefined } : current
    );
  };

  const loadSettings = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("dj_profiles")
      .select(
        "id, slug, dj_name, genres, bio, request_price, shoutout_price, max_pending_requests, max_queue_requests, hidden_from_discovery, profile_image_url, plan, stripe_subscription_status, stripe_connected"
      )
      .eq("user_id", session.user.id)
      .limit(1)
      .maybeSingle();

    /*
     * Unknown is not default.
     *
     * This used to log the error, clear the loading flag and return,
     * leaving the form on its useState defaults — so a failed load
     * rendered £5, £8, 8 and 8 as though they were the DJ's settings,
     * showed a Pro DJ as Free on 15%, and showed a connected Stripe
     * account as disconnected. Two of those are commercial claims. The
     * Save button was also live and silently did nothing, because the
     * handler returned early on a null profile with no message at all.
     */
    if (error || !data) {
      console.log("Settings load error:", error);
      setLoadError("We couldn't load your settings.");
      setLoading(false);
      return;
    }

    const next: FormState = {
      djName: data.dj_name ?? "",
      genres: Array.isArray(data.genres) ? data.genres.join(", ") : "",
      bio: data.bio ?? "",
      requestPrice: penceToPounds(data.request_price ?? 0),
      messagePrice: penceToPounds(data.shoutout_price ?? 0),
      maxPending: String(data.max_pending_requests ?? ""),
      maxQueue: String(data.max_queue_requests ?? ""),
      showInDiscovery: data.hidden_from_discovery !== true,
    };

    setProfile({
      id: data.id,
      slug: data.slug,
      profile_image_url: data.profile_image_url,
      plan: data.plan,
      stripe_subscription_status: data.stripe_subscription_status,
      stripe_connected: data.stripe_connected,
    });
    setProfileImageUrl(data.profile_image_url ?? "");
    setForm(next);
    setBaseline(next);
    setLoadError("");
    setLoading(false);
  };

  useEffect(() => {
    /*
     * Same arrangement the earnings and analytics pages use: nothing
     * here writes state before an await, and the rule cannot see
     * through the await to tell that apart from a synchronous write.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSettings();
    setNotificationPrefsState(getNotificationPreferences());

    getExistingPushSubscription().then((subscription) => {
      setPushEnabled(!!subscription);
    });

    fetch("/api/qr-box/availability")
      .then((response) => response.json())
      .then((data) => setQrBoxAvailable(Boolean(data.available)))
      .catch((error) => console.log("QR box availability fetch error:", error));

    if (searchParams.get("pro") === "success") {
      toast.success(
        "Welcome to Pro! This can take a few seconds to appear below."
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = useMemo(
    () =>
      Boolean(form && baseline) &&
      JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline]
  );

  /*
   * Unsaved settings are easy to walk away from: nothing on this page
   * looks like it is mid-edit, and prices and caps take effect the
   * moment they land, so losing an edit silently means a DJ believing
   * they charge one thing while charging another.
   */
  useEffect(() => {
    if (!dirty) return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();

    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const leave = (destination: string) => {
    if (
      dirty &&
      !window.confirm("You have unsaved settings. Leave without saving?")
    ) {
      return;
    }

    router.push(destination);
  };

  const saveSettings = async () => {
    if (!form || saving) return;

    setSaveError("");
    const payload = toPayload(form);

    /*
     * Run the authority's own validator here first, purely so the DJ
     * gets errors without a round trip. The server runs it again and
     * its answer is the one that counts.
     */
    const local = validateSettings(payload);

    if (!local.ok) {
      setFieldErrors(local.errors);
      setSaveError("Some settings need fixing before this can save.");
      return;
    }

    setSaving(true);
    setFieldErrors({});

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/dj/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        /*
         * The typed values stay exactly where they are. A settings page
         * that clears the form on failure loses work the DJ has to
         * redo, and one that keeps the form but says "saved" is worse.
         */
        if (result.errors) setFieldErrors(result.errors as FieldErrors);
        setSaveError(result.error || "Your settings couldn't be saved.");
        return;
      }

      /*
       * Re-seeded from what the database returned, not from what the
       * form believes it sent, and without refetching the page into a
       * loading screen — the old save flow set loading true again, so
       * every successful save flashed the whole page back to
       * "Loading settings...".
       */
      const saved = result.settings;

      const next: FormState = {
        djName: saved.dj_name ?? "",
        genres: Array.isArray(saved.genres) ? saved.genres.join(", ") : "",
        bio: saved.bio ?? "",
        requestPrice: penceToPounds(saved.request_price ?? 0),
        messagePrice: penceToPounds(saved.shoutout_price ?? 0),
        maxPending: String(saved.max_pending_requests ?? ""),
        maxQueue: String(saved.max_queue_requests ?? ""),
        showInDiscovery: saved.hidden_from_discovery !== true,
      };

      setForm(next);
      setBaseline(next);
      setJustSaved(true);
      toast.success("Settings saved");
    } catch (error) {
      console.log("Settings save error:", error);
      setSaveError("Your settings couldn't be saved. Nothing has changed.");
    } finally {
      setSaving(false);
    }
  };

  const copyRequestLink = async () => {
    if (!profile) return;

    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/request/${profile.slug}`
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link. Long-press it to copy instead.");
    }
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
      const token = await getAccessToken();

      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/stripe/subscribe", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await response.json();

      if (!response.ok || !result.url) {
        throw new Error(result.error || "Unable to start the Pro upgrade.");
      }

      window.location.href = result.url;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong."
      );
      setSubscribing(false);
    }
  };

  const manageBilling = async () => {
    if (openingPortal) return;
    setOpeningPortal(true);

    try {
      const token = await getAccessToken();

      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/stripe/billing-portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await response.json();

      if (!response.ok || !result.url) {
        throw new Error(result.error || "Unable to open billing.");
      }

      window.location.href = result.url;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong."
      );
      setOpeningPortal(false);
    }
  };

  const selectProfileImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    // Allows picking the same file twice in a row.
    event.target.value = "";

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setCropSrc(reader.result as string);
    };

    reader.readAsDataURL(file);
  };

  const cancelCrop = () => {
    setCropSrc(null);
    setCroppedAreaPixels(null);
  };

  const saveCroppedImage = async () => {
    if (!cropSrc || !croppedAreaPixels || !profile) return;

    setUploadingImage(true);

    let imageBlob: Blob;

    try {
      imageBlob = await getCroppedImageBlob(cropSrc, croppedAreaPixels);
    } catch (caughtError) {
      setUploadingImage(false);
      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to process the image."
      );
      return;
    }

    const fileName = `${profile.id}-${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("dj-profile-images")
      .upload(fileName, imageBlob, { upsert: true, contentType: "image/jpeg" });

    if (uploadError) {
      setUploadingImage(false);
      toast.error(uploadError.message);
      return;
    }

    const { data } = supabase.storage
      .from("dj-profile-images")
      .getPublicUrl(fileName);

    const imageUrl = data.publicUrl;

    /*
     * Still a direct write. The image carries no pricing or capacity
     * rule to bypass, so it does not need the settings route's
     * validation, and it saves on its own the moment it is cropped —
     * which is why it sits outside the Save button's remit below.
     */
    const { error } = await supabase
      .from("dj_profiles")
      .update({ profile_image_url: imageUrl })
      .eq("id", profile.id);

    setUploadingImage(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setCropSrc(null);
    setCroppedAreaPixels(null);
    setProfileImageUrl(imageUrl);
    toast.success("Profile image updated");
  };

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

  const header = (
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Settings</h1>

      <Button
        variant="secondary"
        className="h-11 shrink-0 px-4 text-[13px]"
        onClick={() => leave("/dj/dashboard")}
      >
        {cameFromOnboarding ? "Onboarding" : "Dashboard"}
      </Button>
    </div>
  );

  if (!loading && loadError) {
    return (
      <main className="min-h-screen bg-canvas px-4 py-4 text-white sm:px-6 sm:py-8">
        <section className="mx-auto max-w-3xl">
          {header}

          <div className="mt-4 rounded-card border border-white/10 bg-surface-raised p-6 text-center">
            <h2 className="text-lg font-bold">{loadError}</h2>

            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-5 text-zinc-400">
              This is a loading problem, not a problem with your account.
              Your prices, limits and plan are all exactly as you left them.
            </p>

            <Button
              className="mt-4"
              onClick={() => {
                setLoading(true);
                setLoadError("");
                loadSettings();
              }}
            >
              Try again
            </Button>
          </div>
        </section>
      </main>
    );
  }

  if (loading || !form || !profile) {
    return (
      <main className="min-h-screen bg-canvas px-4 py-4 text-white sm:px-6 sm:py-8">
        <div className="mx-auto max-w-3xl">
          <Skeleton className="h-64 rounded-card" />
          <Skeleton className="mt-4 h-48 rounded-card" />
          <Skeleton className="mt-4 h-40 rounded-card" />
          <p className="sr-only" role="status">
            Loading your settings
          </p>
        </div>
      </main>
    );
  }

  const isActivePro =
    profile.plan === "pro" && profile.stripe_subscription_status === "active";
  const hasPaymentIssue =
    profile.plan === "pro" &&
    profile.stripe_subscription_status !== null &&
    profile.stripe_subscription_status !== "active";
  const feePercent =
    (isActivePro ? PRO_PLATFORM_FEE_BPS : FREE_PLATFORM_FEE_BPS) / 100;

  const requestPence = poundsToPence(form.requestPrice);
  const preview =
    requestPence !== null ? previewPrice(requestPence, isActivePro) : null;

  const genreCount = parseGenres(form.genres).length;
  const requestLink = `${typeof window === "undefined" ? "" : window.location.origin}/request/${profile.slug}`;

  return (
    <main className="min-h-screen bg-canvas px-4 py-4 pb-28 text-white sm:px-6 sm:py-8">
      <section className="mx-auto max-w-3xl">
        {header}

        {/* ── 1. Your profile ──────────────────────────────────────── */}
        <Section
          title="Your profile"
          description="What a guest sees when they scan your code."
        >
          <div>
            <p className="text-[13px] font-semibold text-zinc-200">
              Profile image
            </p>

            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
              {profileImageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={profileImageUrl}
                  alt=""
                  className="h-20 w-20 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs text-zinc-400">
                  No image
                </div>
              )}

              <label className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-control border border-white/10 bg-white/5 px-4 text-[13px] font-semibold text-white transition hover:bg-white/10 sm:w-auto">
                {uploadingImage
                  ? "Uploading..."
                  : profileImageUrl
                    ? "Change image"
                    : "Upload image"}

                <input
                  type="file"
                  accept="image/*"
                  onChange={selectProfileImage}
                  disabled={uploadingImage}
                  className="sr-only"
                />
              </label>
            </div>

            {/* Saves on its own, so it says so rather than letting the
                Save button below look responsible for it. */}
            <p className="mt-2 text-xs text-zinc-400">
              Your image saves as soon as you crop it.
            </p>
          </div>

          <Field
            label="DJ name"
            error={fieldErrors.djName}
            counter={`${form.djName.length} / ${LIMITS.djName.max}`}
          >
            {(props) => (
              <Input
                {...props}
                value={form.djName}
                maxLength={LIMITS.djName.max}
                onChange={(event) => update("djName", event.target.value)}
              />
            )}
          </Field>

          <Field
            label="Genres"
            hint="Separate with commas. Shown on your request page."
            error={fieldErrors.genres}
            counter={`${genreCount} / ${LIMITS.genres.maxCount}`}
          >
            {(props) => (
              <Input
                {...props}
                value={form.genres}
                placeholder="House, UK Garage, Tech House"
                onChange={(event) => update("genres", event.target.value)}
              />
            )}
          </Field>

          <Field
            label="Bio"
            hint="Plain text. A line or two about what you play."
            error={fieldErrors.bio}
            counter={`${form.bio.length} / ${LIMITS.bio.max}`}
          >
            {(props) => (
              <Textarea
                {...props}
                value={form.bio}
                rows={4}
                maxLength={LIMITS.bio.max}
                onChange={(event) => update("bio", event.target.value)}
              />
            )}
          </Field>

          {/*
            Read-only, and explained rather than simply disabled.

            The slug is not editable anywhere in the product and should
            not become editable casually: it is encoded into every
            printed QR code, and it keys the guest's own request history
            in their browser storage (myRequestIds_<slug>). Changing it
            would both break printed material and cut guests off from
            requests they have already paid for.
          */}
          <div>
            <p className="text-[13px] font-semibold text-zinc-200">
              Your request link
            </p>

            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <p className="min-w-0 flex-1 truncate rounded-control border border-white/10 bg-surface-base/60 px-3 py-3 text-[13px] text-zinc-300">
                {requestLink}
              </p>

              <Button
                variant="secondary"
                className="h-11 shrink-0 px-4 text-[13px]"
                onClick={copyRequestLink}
              >
                {copied ? (
                  <>
                    <Check size={14} aria-hidden className="mr-1.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={14} aria-hidden className="mr-1.5" />
                    Copy link
                  </>
                )}
              </Button>
            </div>

            <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-zinc-400">
              <Lock size={12} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                This link is fixed. Changing it would break any QR code
                you have already printed, and the request history your
                guests have saved on their phones. Your QR code lives on
                the dashboard.
              </span>
            </p>
          </div>

          <Switch
            label="Show me in Find Your DJ"
            description="Lets guests find you by name on the Playing Next homepage. Turning this off does not affect your request link or your QR code, which keep working either way."
            checked={form.showInDiscovery}
            onChange={(next) => update("showInDiscovery", next)}
          />
        </Section>

        {/* ── 2. Request pricing ───────────────────────────────────── */}
        <Section
          title="Request pricing"
          description="What you charge per request. Changes take effect immediately for new requests. Anything already paid for keeps the price it was charged."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Standard request" error={fieldErrors.requestPrice}>
              {(props) => (
                <div className="relative">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
                  >
                    £
                  </span>
                  <Input
                    {...props}
                    inputMode="decimal"
                    value={form.requestPrice}
                    onChange={(event) =>
                      update("requestPrice", event.target.value)
                    }
                    className="pl-8"
                  />
                </div>
              )}
            </Field>

            <Field
              label="Song + Message"
              error={fieldErrors.messagePrice}
              hint="Must cost more than a standard request."
            >
              {(props) => (
                <div className="relative">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
                  >
                    £
                  </span>
                  <Input
                    {...props}
                    inputMode="decimal"
                    value={form.messagePrice}
                    onChange={(event) =>
                      update("messagePrice", event.target.value)
                    }
                    className="pl-8"
                  />
                </div>
              )}
            </Field>
          </div>

          {/*
            The two numbers a DJ types are neither what the guest pays
            nor what the DJ receives. Same constants and the same
            arithmetic as the checkout route, so this cannot quote a
            figure the real charge disagrees with.
          */}
          {preview && (
            <div className="rounded-control border border-white/10 bg-surface-base/60 p-3.5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                On a standard request
              </p>

              <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1.5 text-[13px]">
                <span className="text-zinc-300">
                  Guest pays{" "}
                  <MoneyValue
                    pence={preview.guestPays}
                    compact={false}
                    className="font-bold text-white"
                  />
                </span>

                <span className="text-zinc-300">
                  You receive{" "}
                  <MoneyValue
                    pence={preview.djReceives}
                    compact={false}
                    className="font-bold text-accent"
                  />
                </span>
              </div>

              <p className="mt-2 text-xs leading-5 text-zinc-400">
                Guests pay a{" "}
                <MoneyValue
                  pence={preview.serviceFee}
                  className="text-zinc-300"
                />{" "}
                service fee on top of your price. That is ours, not yours:
                you cannot change it and it never comes out of what you
                earn. Your {feePercent}% platform fee on the{" "}
                {isActivePro ? "Pro" : "Free"} plan is already taken off
                the figure above.
              </p>
            </div>
          )}
        </Section>

        {/* ── 3. Capacity ──────────────────────────────────────────── */}
        <Section
          title="Capacity"
          description="How much can pile up at once. Changes take effect immediately."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Needs You limit"
              hint="Requests waiting on your decision. At this many, guests are told you are catching up rather than being taken payment from."
              error={fieldErrors.maxPending}
            >
              {(props) => (
                <Input
                  {...props}
                  inputMode="numeric"
                  value={form.maxPending}
                  onChange={(event) => update("maxPending", event.target.value)}
                />
              )}
            </Field>

            <Field
              label="Queue limit"
              hint="Songs you have accepted and not yet played. At this many, you cannot accept another until one is played."
              error={fieldErrors.maxQueue}
            >
              {(props) => (
                <Input
                  {...props}
                  inputMode="numeric"
                  value={form.maxQueue}
                  onChange={(event) => update("maxQueue", event.target.value)}
                />
              )}
            </Field>
          </div>

          <p className="text-xs leading-5 text-zinc-400">
            Anything from {LIMITS.maxPending.min} to {LIMITS.maxPending.max}.
            Past twenty you stop being able to read your own queue mid-set.
          </p>
        </Section>

        {/* ── 4. Alerts ────────────────────────────────────────────── */}
        <Section
          title="Alerts"
          description="How you hear about a new request. These are per-device and save on their own, so the Save button below does not cover them. Set them up on whatever you run the dashboard on tonight."
        >
          <Switch
            label="Sound"
            description="Plays a short chime when a new request comes in."
            checked={notificationPrefs.sound}
            onChange={toggleSound}
          />

          <Switch
            label="Browser notifications"
            description="Alerts you even if this tab is not focused."
            checked={notificationPrefs.browser}
            onChange={toggleBrowserNotifications}
          />

          <Switch
            label="Push notifications"
            description="Alerts you even if this tab or browser is closed."
            checked={pushEnabled}
            disabled={togglingPush}
            onChange={togglePushNotifications}
          />
        </Section>

        {/* ── 5. Plan ──────────────────────────────────────────────── */}
        <Section title="Plan">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-lg font-bold">
              {isActivePro ? "Pro" : "Free"}
              <span className="ml-2 text-[13px] font-medium text-zinc-400">
                {/* From the constants, not typed in. The old page had
                    "15%" and "0%" as literal strings in three places. */}
                {feePercent}% platform fee per accepted request
              </span>
            </p>

            {/* Only Pro has a subscription state worth badging. A Free
                DJ used to be shown a green "Active" pill, which reads as
                a subscription being active when there is none. */}
            {hasPaymentIssue && (
              <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400">
                Payment issue
              </span>
            )}
          </div>

          {hasPaymentIssue && (
            <p className="text-[13px] leading-5 text-amber-400">
              There is a problem with your Pro payment, so you are being
              charged the Free rate of {FREE_PLATFORM_FEE_BPS / 100}% until
              it is resolved.
            </p>
          )}

          {isActivePro ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] text-zinc-400">
                Manage your card, invoices, or cancel Pro.
              </p>

              <Button
                variant="secondary"
                className="h-11 shrink-0 px-4 text-[13px]"
                onClick={manageBilling}
                disabled={openingPortal}
              >
                {openingPortal ? "Opening..." : "Manage billing"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[13px] text-zinc-300">
                  Pro is £{PRO_MONTHLY_PRICE_GBP.toFixed(2)} a month, with a{" "}
                  {PRO_PLATFORM_FEE_BPS / 100}% platform fee and full
                  analytics.
                </p>

                <Link
                  href="/plans"
                  className="mt-1 inline-flex min-h-11 items-center text-[13px] font-semibold text-zinc-400 underline underline-offset-4 hover:text-white"
                >
                  Compare plans
                </Link>

                {qrBoxAvailable && (
                  <p className="text-xs font-semibold text-amber-400">
                    First 50 DJs to go Pro get a free QR display block, just
                    pay shipping.
                  </p>
                )}
              </div>

              <Button
                variant="secondary"
                className="h-11 shrink-0 px-4 text-[13px]"
                onClick={upgradeToPro}
                disabled={subscribing}
              >
                {subscribing ? "Opening..." : "Upgrade to Pro"}
              </Button>
            </div>
          )}
        </Section>

        {/* ── 6. Payments ──────────────────────────────────────────── */}
        <Section title="Payments">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] leading-5 text-zinc-400">
              {profile.stripe_connected
                ? "Stripe is connected. Manage your payout account and bank details."
                : "You need a connected Stripe account before guests can pay you."}
            </p>

            <Button
              variant="secondary"
              className="h-11 shrink-0 px-4 text-[13px]"
              onClick={() => leave("/dj/settings/payments")}
            >
              {profile.stripe_connected ? "Manage payments" : "Connect Stripe"}
            </Button>
          </div>
        </Section>
      </section>

      {/*
        The save bar covers the form above it and nothing else. Alerts,
        plan and payments each act on their own and say so, which is what
        the old single "Save Settings" button at the bottom of everything
        quietly implied it was doing.
      */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-surface-raised/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            {saveError ? (
              <p role="alert" className="text-xs leading-5 text-status-declined">
                {saveError}
              </p>
            ) : (
              <p role="status" className="text-xs leading-5 text-zinc-400">
                {saving
                  ? "Saving your settings"
                  : justSaved
                    ? "Settings saved"
                    : dirty
                      ? "You have unsaved changes"
                      : "Profile, pricing and capacity"}
              </p>
            )}
          </div>

          <Button
            className="h-11 shrink-0 px-5 text-[13px]"
            onClick={saveSettings}
            disabled={saving || !dirty}
            aria-busy={saving}
          >
            {saving ? "Saving..." : justSaved && !dirty ? "Saved" : "Save"}
          </Button>
        </div>
      </div>

      {cropSrc && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm">
          <div className="relative flex-1">
            <Cropper
              image={cropSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
            />
          </div>

          <div className="flex flex-col gap-4 border-t border-white/10 bg-canvas p-5 sm:p-6">
            <div className="mx-auto flex w-full max-w-sm items-center gap-3">
              <label htmlFor="crop-zoom" className="text-xs text-zinc-400">
                Zoom
              </label>
              <input
                id="crop-zoom"
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="w-full accent-accent-strong"
              />
            </div>

            <div className="mx-auto flex w-full max-w-sm gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={cancelCrop}
                disabled={uploadingImage}
              >
                Cancel
              </Button>

              <Button
                className="flex-1"
                onClick={saveCroppedImage}
                disabled={uploadingImage || !croppedAreaPixels}
              >
                {uploadingImage ? "Saving..." : "Save image"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function DJSettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-canvas px-4 py-4 text-white sm:px-6 sm:py-8">
          <div className="mx-auto max-w-3xl">
            <Skeleton className="h-64 rounded-card" />
            <p className="sr-only" role="status">
              Loading your settings
            </p>
          </div>
        </main>
      }
    >
      <DJSettingsPageContent />
    </Suspense>
  );
}
