"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { supabase } from "../src/lib/supabase";
import Navbar from "@/src/components/home/Navbar";
import SceneOpening from "@/src/components/home/scenes/SceneOpening";
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

  const [accepted, setAccepted] = useState(false);
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
    if (accepted) return;
    setAccepted(true);

    if (shouldReduceMotion) {
      afterOpeningRef.current?.scrollIntoView({ block: "start" });
      return;
    }

    /*
     * Hold on the confirmed state before moving, so the accept reads
     * as a completed action rather than something that got
     * interrupted by a scroll.
     */
    window.setTimeout(() => {
      afterOpeningRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, ACCEPT.holdAfterAcceptMs);
  }, [accepted, shouldReduceMotion]);

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

      <SceneOpening accepted={accepted} onAccept={handleAccept} />

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
