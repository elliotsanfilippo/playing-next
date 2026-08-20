"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { supabase } from "../src/lib/supabase";
import Navbar from "@/src/components/home/Navbar";
import SceneOpening, {
  type OpeningStage,
} from "@/src/components/home/scenes/SceneOpening";
import SceneQueue from "@/src/components/home/scenes/SceneQueue";
import SceneGuest from "@/src/components/home/scenes/SceneGuest";
import SceneEarnings from "@/src/components/home/scenes/SceneEarnings";
import SceneProduct from "@/src/components/home/scenes/SceneProduct";
import SearchStation, {
  type HomeDJ,
} from "@/src/components/home/SearchStation";
import PricingTeaser from "@/src/components/home/PricingTeaser";
import CTA from "@/src/components/home/CTA";
import Footer from "@/src/components/home/Footer";
import { ACCEPT } from "@/src/components/home/scenes/timings";

/*
 * The homepage as a single continuous story:
 *
 *   Request → Accept → Queue → Playing Next → Guest → Earnings
 *   → Product → Find a DJ → Pricing → CTA
 *
 * The opening Accept Request interaction is an invitation, not a gate.
 * Clicking it plays the strongest transition in the page, but every
 * scene below is in the DOM from first paint and reachable by simply
 * scrolling — nothing is conditionally mounted behind an interaction.
 */
export default function HomePage() {
  const shouldReduceMotion = useReducedMotion();

  const [search, setSearch] = useState("");
  const [djs, setDjs] = useState<HomeDJ[]>([]);
  const [loadingDJs, setLoadingDJs] = useState(true);

  /*
   * The opening runs idle → accepted → landed. It only ever moves
   * forward: once landed, scrolling back up shows a completed
   * dashboard rather than resetting the invitation, so the visitor
   * can revisit the opening without being re-prompted.
   */
  const [openingStage, setOpeningStage] = useState<OpeningStage>("idle");
  const accepted = openingStage !== "idle";
  const [scrolledPastOpening, setScrolledPastOpening] = useState(false);
  const afterOpeningRef = useRef<HTMLDivElement>(null);

  /*
   * Derived rather than stored: the nav is visible once the visitor
   * has scrolled past the opening beat, or accepted, or has reduced
   * motion on (in which case there's no cinematic opening to protect).
   */
  const navRevealed = scrolledPastOpening || accepted || Boolean(shouldReduceMotion);

  useEffect(() => {
    const fetchDJs = async () => {
      setLoadingDJs(true);

      const { data, error } = await supabase
        .from("dj_profiles")
        .select(
          "dj_name, slug, profile_image_url, request_status, genres"
        )
        .neq("dj_name", "New DJ")
        .eq("hidden_from_discovery", false)
        .order("dj_name", { ascending: true });

      if (error) {
        console.error("DJ search error:", error);
        setLoadingDJs(false);
        return;
      }

      setDjs(data || []);
      setLoadingDJs(false);
    };

    fetchDJs();
  }, []);

  /*
   * The nav stays out of the way during the opening beat so nothing
   * competes with the Accept Request moment, then comes in once the
   * visitor scrolls past it.
   */
  useEffect(() => {
    if (shouldReduceMotion) return;

    const onScroll = () => {
      setScrolledPastOpening(window.scrollY > window.innerHeight * 0.35);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [shouldReduceMotion]);

  const handleAccept = useCallback(() => {
    if (openingStage !== "idle") return;

    setOpeningStage("accepted");

    /*
     * Hold on the revealed song before the dashboard builds around it,
     * so the reveal reads as the payoff for accepting rather than a
     * frame the visitor blinks past. Under reduced motion the whole
     * sequence resolves immediately.
     */
    if (shouldReduceMotion) {
      setOpeningStage("landed");
      return;
    }

    window.setTimeout(
      () => setOpeningStage("landed"),
      ACCEPT.holdAfterAcceptMs
    );
  }, [openingStage, shouldReduceMotion]);

  const filteredDJs = useMemo(() => {
    const normalisedSearch = search.trim().toLowerCase();

    if (!normalisedSearch) {
      return [];
    }

    return djs
      .filter((dj) =>
        dj.dj_name.toLowerCase().includes(normalisedSearch)
      )
      .slice(0, 6);
  }, [djs, search]);

  return (
    <main className="relative min-h-screen bg-canvas text-white">
      <Navbar revealed={navRevealed || accepted} />

      <SceneOpening stage={openingStage} onAccept={handleAccept} />

      {/* Everything past the opening sits above the pinned scene, so
          the recede/pull-back reads as the page arriving over it. */}
      <div ref={afterOpeningRef} className="relative z-10 bg-canvas">
        <SceneQueue accepted={accepted} />

        <SceneGuest />

        <SceneEarnings />

        <SceneProduct />

        <SearchStation
          search={search}
          setSearch={setSearch}
          loadingDJs={loadingDJs}
          filteredDJs={filteredDJs}
        />

        <PricingTeaser />

        <CTA />

        <Footer />
      </div>
    </main>
  );
}
