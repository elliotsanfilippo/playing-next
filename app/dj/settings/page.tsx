"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Cropper, { type Area } from "react-easy-crop";
import { Check, Copy } from "lucide-react";
import { supabase } from "../../../src/lib/supabase";
import { getCroppedImageBlob } from "@/src/lib/cropImage";
import {
  FREE_PLATFORM_FEE_BPS,
  PRO_PLATFORM_FEE_BPS,
} from "@/src/lib/pricing";
import { hasBillingProblem, isProEntitled } from "@/src/lib/planEntitlement";
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
import SettingsGroup from "./components/SettingsGroup";
import SettingRow, { ActionRow, StaticRow } from "./components/SettingRow";
import SwitchRow from "./components/SwitchRow";
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
  stripe_account_id: string | null;
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

/** The resting value for a price row. Shows what is in the box when it
 *  cannot be parsed, so a half-typed value is never dressed up as a
 *  price the DJ has not actually set. */
const priceLabel = (pounds: string): string => {
  const pence = poundsToPence(pounds);
  return pence === null ? pounds || "Not set" : `£${penceToPounds(pence)}`;
};

/** The £ prefix is decoration over an ordinary text input: a number
 *  input would let a spinner produce values the validator then has to
 *  reject, and its arrows are useless for money on a phone. */
function PriceInput({
  value,
  onChange,
  ...props
}: {
  value: string;
  onChange: (next: string) => void;
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": boolean | undefined;
}) {
  return (
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
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pl-8"
      />
    </div>
  );
}

/** Row order, so a failed save opens the topmost problem rather than
 *  whichever key the validator happened to write first. */
const ROW_ORDER: (keyof FormState)[] = [
  "djName",
  "genres",
  "bio",
  "requestPrice",
  "messagePrice",
  "maxPending",
  "maxQueue",
];

const firstErroredRow = (errors: FieldErrors): keyof FormState | null =>
  ROW_ORDER.find((row) => errors[row as keyof FieldErrors]) ?? null;

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

  /*
   * Which row is open for editing, if any. One at a time: the point of
   * the row treatment is that a DJ changing a price is looking at that
   * price, not at every field on the page at once.
   */
  const [openRow, setOpenRow] = useState<keyof FormState | null>(null);

  /* The Photo row is a row like any other, so the file input it drives
     lives outside the list and is clicked programmatically. */
  const imageInputRef = useRef<HTMLInputElement>(null);

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
        "id, slug, dj_name, genres, bio, request_price, shoutout_price, max_pending_requests, max_queue_requests, hidden_from_discovery, profile_image_url, plan, stripe_subscription_status, stripe_connected, stripe_account_id"
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
      stripe_account_id: data.stripe_account_id,
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

  /*
   * Counted per field rather than as a boolean, so the bar can say how
   * much is outstanding. Same comparison the dirty flag has always
   * used; nothing about when a save is allowed has changed.
   */
  const changeCount = useMemo(() => {
    if (!form || !baseline) return 0;

    return (Object.keys(form) as (keyof FormState)[]).filter(
      (key) => form[key] !== baseline[key]
    ).length;
  }, [form, baseline]);

  const dirty = changeCount > 0;

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

  const toggleRow = (row: keyof FormState) =>
    setOpenRow((current) => (current === row ? null : row));

  const discard = () => {
    if (!baseline) return;

    setForm(baseline);
    setFieldErrors({});
    setSaveError("");
    setOpenRow(null);
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
      /* An error inside a collapsed row is an error nobody can see. */
      setOpenRow(firstErroredRow(local.errors));
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
        if (result.errors) {
          setFieldErrors(result.errors as FieldErrors);
          setOpenRow(firstErroredRow(result.errors as FieldErrors));
        }
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
      setOpenRow(null);
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

  const isActivePro = isProEntitled(profile);
  /* Entitled, but Stripe is retrying the card. Worth saying; not worth
     taking anything away for. */
  const hasPaymentIssue = hasBillingProblem(profile);
  const feePercent =
    (isActivePro ? PRO_PLATFORM_FEE_BPS : FREE_PLATFORM_FEE_BPS) / 100;

  const requestPence = poundsToPence(form.requestPrice);
  const preview =
    requestPence !== null ? previewPrice(requestPence, isActivePro) : null;

  const genreList = parseGenres(form.genres);
  const requestLink = `${typeof window === "undefined" ? "" : window.location.origin}/request/${profile.slug}`;

  return (
    <main className="min-h-screen bg-canvas px-4 py-4 pb-28 text-white sm:px-6 sm:py-8">
      <section className="mx-auto max-w-3xl">
        {header}

        {/*
          Four groups instead of six expanded forms.

          Each row states its name and what it is currently set to, and
          opens an editor only when it is pressed. The old page showed
          every input and 303 words of explanation permanently, so a DJ
          changing one price read the whole page to find it. A value on
          the right explains a setting better than a sentence under it.
        */}

        {/* ── Your profile ─────────────────────────────────────────── */}
        <SettingsGroup title="Your profile">
          <ActionRow
            label="Photo"
            value={
              profileImageUrl ? (
                <span className="inline-flex items-center gap-2">
                  <Image
                    src={profileImageUrl}
                    alt=""
                    width={28}
                    height={28}
                    sizes="28px"
                    className="h-7 w-7 rounded-full object-cover"
                  />
                  <span>Change</span>
                </span>
              ) : (
                "Add a photo"
              )
            }
            onClick={() => imageInputRef.current?.click()}
            disabled={uploadingImage}
          />

          <SettingRow
            label="DJ name"
            value={form.djName || "Not set"}
            error={fieldErrors.djName}
            expanded={openRow === "djName"}
            onToggle={() => toggleRow("djName")}
          >
            {(props) => (
              <Input
                {...props}
                value={form.djName}
                maxLength={LIMITS.djName.max}
                onChange={(event) => update("djName", event.target.value)}
              />
            )}
          </SettingRow>

          <SettingRow
            label="Genres"
            value={genreList.length ? genreList.join(", ") : "None"}
            hint={`Separate with commas. Up to ${LIMITS.genres.maxCount}.`}
            error={fieldErrors.genres}
            expanded={openRow === "genres"}
            onToggle={() => toggleRow("genres")}
          >
            {(props) => (
              <Input
                {...props}
                value={form.genres}
                placeholder="House, UK Garage, Tech House"
                onChange={(event) => update("genres", event.target.value)}
              />
            )}
          </SettingRow>

          <SettingRow
            label="Bio"
            value={form.bio.trim() ? form.bio.trim() : "Not set"}
            hint={`${form.bio.length} of ${LIMITS.bio.max} characters.`}
            error={fieldErrors.bio}
            expanded={openRow === "bio"}
            onToggle={() => toggleRow("bio")}
          >
            {(props) => (
              <Textarea
                {...props}
                value={form.bio}
                rows={4}
                maxLength={LIMITS.bio.max}
                placeholder="A line or two about what you play."
                onChange={(event) => update("bio", event.target.value)}
              />
            )}
          </SettingRow>

          {/*
            Read-only and explained in one sentence rather than three.
            The slug is encoded in every printed QR code and it keys the
            guest's own request history in their browser storage, so it
            is the one thing on this page whose consequence is worth
            stating even though nobody can trigger it.
          */}
          <StaticRow
            label="Request link"
            note="Fixed, because it is printed on your QR codes and saved on your guests' phones."
          >
            <div className="flex items-center gap-2">
              {/* Deliberately not styled like an input. It was a bordered
                  box the width of a field, which is what an editable
                  value looks like everywhere else on this page. */}
              <p className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-300">
                {requestLink}
              </p>

              <Button
                variant="secondary"
                className="h-11 shrink-0 px-3 text-xs"
                onClick={copyRequestLink}
              >
                {copied ? (
                  <>
                    <Check size={13} aria-hidden className="mr-1.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={13} aria-hidden className="mr-1.5" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </StaticRow>

          <SwitchRow
            label="Show me in Find Your DJ"
            description="Lets guests find you by name on the homepage."
            note="Your request link and QR code still work."
            checked={form.showInDiscovery}
            onChange={(next) => update("showInDiscovery", next)}
          />
        </SettingsGroup>

        {/* ── Requests ─────────────────────────────────────────────── */}
        <SettingsGroup
          title="Requests"
          footer="Guests also pay Playing Next's fixed 50p service fee. Changes apply to new requests, and anything already paid for keeps the price it was charged."
        >
          <SettingRow
            label="Song request"
            value={priceLabel(form.requestPrice)}
            error={fieldErrors.requestPrice}
            expanded={openRow === "requestPrice"}
            onToggle={() => toggleRow("requestPrice")}
          >
            {(props) => (
              <>
                <PriceInput
                  {...props}
                  value={form.requestPrice}
                  onChange={(next) => update("requestPrice", next)}
                />

                {/* The only place the fee split appears. It used to be
                    44 words of small print under the fields, repeating
                    what the Plan group already says. */}
                {preview && (
                  <p className="mt-2 text-xs leading-5 text-zinc-400">
                    Guest pays{" "}
                    <MoneyValue
                      pence={preview.guestPays}
                      compact={false}
                      className="font-semibold text-zinc-200"
                    />
                    , you receive{" "}
                    <MoneyValue
                      pence={preview.djReceives}
                      compact={false}
                      className="font-semibold text-accent"
                    />
                    .
                  </p>
                )}
              </>
            )}
          </SettingRow>

          <SettingRow
            label="Song + Message"
            value={priceLabel(form.messagePrice)}
            hint="Costs more than a standard request."
            error={fieldErrors.messagePrice}
            expanded={openRow === "messagePrice"}
            onToggle={() => toggleRow("messagePrice")}
          >
            {(props) => (
              <PriceInput
                {...props}
                value={form.messagePrice}
                onChange={(next) => update("messagePrice", next)}
              />
            )}
          </SettingRow>

          <SettingRow
            label="Needs You limit"
            value={form.maxPending || "Not set"}
            hint={`How many requests can wait for your decision. ${LIMITS.maxPending.min} to ${LIMITS.maxPending.max}. Guests are told you are catching up once it is reached.`}
            error={fieldErrors.maxPending}
            expanded={openRow === "maxPending"}
            onToggle={() => toggleRow("maxPending")}
          >
            {(props) => (
              <Input
                {...props}
                inputMode="numeric"
                value={form.maxPending}
                onChange={(event) => update("maxPending", event.target.value)}
              />
            )}
          </SettingRow>

          <SettingRow
            label="Queue limit"
            value={form.maxQueue || "Not set"}
            hint={`How many accepted songs can wait to be played. ${LIMITS.maxQueue.min} to ${LIMITS.maxQueue.max}. You cannot accept another until one is played.`}
            error={fieldErrors.maxQueue}
            expanded={openRow === "maxQueue"}
            onToggle={() => toggleRow("maxQueue")}
          >
            {(props) => (
              <Input
                {...props}
                inputMode="numeric"
                value={form.maxQueue}
                onChange={(event) => update("maxQueue", event.target.value)}
              />
            )}
          </SettingRow>
        </SettingsGroup>

        {/* ── Notifications ────────────────────────────────────────── */}
        <SettingsGroup
          title="Notifications"
          footer="Per-device, and saved as you switch them."
        >
          <SwitchRow
            label="Sound"
            description="A short chime when a request comes in."
            checked={notificationPrefs.sound}
            onChange={toggleSound}
          />

          <SwitchRow
            label="Browser"
            description="Alerts you when this tab is not focused."
            checked={notificationPrefs.browser}
            onChange={toggleBrowserNotifications}
          />

          <SwitchRow
            label="Push"
            description="Alerts you when the browser is closed."
            checked={pushEnabled}
            disabled={togglingPush}
            onChange={togglePushNotifications}
          />
        </SettingsGroup>

        {/* ── Account ──────────────────────────────────────────────── */}
        <SettingsGroup title="Account">
          {/*
            A Free DJ's Plan row goes to /plans rather than straight into
            Stripe. The row cannot show the subscription price without
            becoming a paragraph, and a tap that starts a £49.99-a-month
            checkout without stating the price first is not a decision
            the DJ has been given the chance to make. /plans states it
            and owns the upgrade. Pro goes to the billing portal, which
            is management rather than a purchase.
          */}
          {isActivePro ? (
            <ActionRow
              label="Plan"
              value={openingPortal ? "Opening..." : `Pro · ${feePercent}% fee`}
              onClick={manageBilling}
              disabled={openingPortal}
            />
          ) : (
            <ActionRow
              label="Plan"
              value={
                hasPaymentIssue ? "Payment issue" : `Free · ${feePercent}% fee`
              }
              onClick={() => leave("/plans")}
            />
          )}

          {/*
            Says only what the cached flag can prove.

            That column now means "can receive Playing Next earnings",
            so a DJ whose bank payouts Stripe has paused reads as
            receiving earnings here rather than as disconnected, which
            is what it used to say. It deliberately does not claim
            "Ready": payout health needs a live Stripe call, and this
            page should not make one on load. The payments page owns
            that distinction and this row routes to it.
          */}
          <ActionRow
            label="Payments"
            value={
              profile.stripe_connected
                ? "Receiving earnings"
                : profile.stripe_account_id
                  ? "Finish setup"
                  : "Not connected"
            }
            onClick={() => leave("/dj/settings/payments")}
          />
        </SettingsGroup>

        {/* Says what is true now. This used to tell the DJ they were
            being charged the Free rate during dunning, which is no
            longer how it works: Pro stays Pro, 0% included, while
            Stripe retries the card. */}
        {hasPaymentIssue && (
          <p className="mt-2 px-1 text-xs leading-5 text-amber-400">
            Your last Pro payment didn&apos;t go through and Stripe is
            retrying it. You keep everything Pro includes in the meantime.
            Update your card so it doesn&apos;t lapse.
          </p>
        )}

        {!isActivePro && qrBoxAvailable && (
          <p className="mt-2 px-1 text-xs leading-5 text-amber-400">
            First 50 DJs to go Pro get a free QR display block, just pay
            shipping.
          </p>
        )}

        <p className="mt-4 px-1 text-xs text-zinc-400">
          Pausing requests and auto-close live on your{" "}
          <button
            type="button"
            onClick={() => leave("/dj/dashboard")}
            className="font-semibold text-zinc-300 underline underline-offset-4 hover:text-white"
          >
            dashboard
          </button>
          .
        </p>
      </section>

      {/* The file picker lives outside the row so the Photo row can be a
          plain button like every other row in the list. */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={selectProfileImage}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />

      {/*
        The bar reports state, not scope.

        It used to read "Profile, pricing and capacity", which is the
        page's own category list rather than anything a DJ wants to
        know. The rows it covers are the rows with editors in them, and
        the two groups that save on their own say so themselves.
      */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-surface-raised/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5">
          <div className="min-w-0 flex-1">
            {saveError ? (
              <p role="alert" className="text-xs leading-5 text-status-declined">
                {saveError}
              </p>
            ) : (
              <p role="status" className="text-[13px] leading-5 text-zinc-300">
                {saving
                  ? "Saving..."
                  : justSaved && !dirty
                    ? "Saved"
                    : dirty
                      ? `${changeCount} unsaved change${changeCount === 1 ? "" : "s"}`
                      : "All changes saved"}
              </p>
            )}
          </div>

          {dirty && !saving && (
            <Button
              variant="secondary"
              className="h-11 shrink-0 px-4 text-[13px]"
              onClick={discard}
            >
              Discard
            </Button>
          )}

          <Button
            className="h-11 shrink-0 px-5 text-[13px]"
            onClick={saveSettings}
            disabled={saving || !dirty}
            aria-busy={saving}
          >
            {saving ? "Saving..." : "Save"}
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
