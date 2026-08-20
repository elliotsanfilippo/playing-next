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
import SceneHowItWorks from "@/src/components/home/scenes/SceneHowItWorks";
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
    <>
      {/*
        The header is a sibling of <main>, not a child of it, so in the
        DOM it is a direct child of <body>. Nothing in the homepage
        scene tree can therefore reach it: not <main>'s overflow clip,
        not the opening scene's sticky pinning, not the pull-back's
        scroll-driven transform, and not anything added to those later.
        A position:fixed box is out of flow, so being a child of the
        body flex column costs no layout either.

        It stays rendered here rather than in the root layout because
        its links are homepage anchors and its reveal is driven by
        homepage state — moving it up a level would put it on every
        route. Rendering it as a sibling gets the same containment
        without that, and keeps it in the server-rendered HTML, which a
        portal would not.
      */}
      <Navbar revealed={navRevealed || accepted} />

    {/* overflow-x-clip, not overflow-x-hidden: the ambient glow layers
        deliberately bleed past their cards, which would otherwise widen
        the page and create a horizontal scrollbar on narrower screens.
        `hidden` would fix that too, but it silently breaks
        `position: sticky` on descendants — and the desktop opening
        depends on sticky pinning. `clip` contains the overflow without
        creating a scroll container. */}
    <main className="relative min-h-screen overflow-x-clip bg-canvas text-white">
      <SceneOpening stage={openingStage} onAccept={handleAccept} />

      {/* Everything past the opening sits above the pinned scene, so
          the recede/pull-back reads as the page arriving over it. */}
      <div ref={afterOpeningRef} className="relative z-10 bg-canvas">
        <SceneQueue accepted={accepted} />

        <SceneGuest />

        {/* Straight after the crowd's side: a visitor who has just
            watched a guest request a song is at peak intent to try it
            themselves, and this is the one section on the page aimed
            at guests rather than DJs. Buried near the footer it read
            as an afterthought. */}
        <SearchStation
          search={search}
          setSearch={setSearch}
          loadingDJs={loadingDJs}
          filteredDJs={filteredDJs}
        />

        <SceneEarnings />

        {/* The practical explainer sits after the story, where the
            question has shifted from "what is this" to "what do I have
            to do". */}
        <SceneHowItWorks />

        <SceneProduct />

        <PricingTeaser />

        <CTA />

        <Footer />
      </div>
    </main>
    </>
  );
}
