"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PoundSterling, Radio, QrCode } from "lucide-react";
import { supabase } from "../src/lib/supabase";
import DashboardPreview from "@/src/components/home/DashboardPreview";
import Navbar from "@/src/components/home/Navbar";
import Hero from "@/src/components/home/Hero";
import SearchStation, {
  type HomeDJ,
} from "@/src/components/home/SearchStation";
import FeatureCards from "@/src/components/home/FeatureCards";
import HowItWorks from "@/src/components/home/HowItWorks";
import ProductShowcase from "@/src/components/home/ProductShowcase";
import CTA from "@/src/components/home/CTA";
import Footer from "@/src/components/home/Footer";

const featureCards = [
  {
    icon: <PoundSterling size={22} />,
    title: "Get paid for requests",
    description:
      "Guests authorise payment when they submit. You decide which requests to accept.",
  },
  {
    icon: <Radio size={22} />,
    title: "Manage your queue live",
    description:
      "Accept, decline and reorder requests in real time from one simple dashboard.",
  },
  {
    icon: <QrCode size={22} />,
    title: "Share one QR code",
    description:
      "Give your crowd one link for song requests, shoutouts and live status updates.",
  },
];

const howItWorks = [
  {
    number: "01",
    title: "Create your account",
    description: "Set up your DJ profile in minutes.",
  },
  {
    number: "02",
    title: "Connect Stripe",
    description: "Securely receive payments and payouts.",
  },
  {
    number: "03",
    title: "Display your QR",
    description: "Share it at your venue, party or event.",
  },
  {
    number: "04",
    title: "Manage requests",
    description: "Stay in control of what enters your queue.",
  },
  {
    number: "05",
    title: "Get paid",
    description: "Accepted requests are captured automatically.",
  },
];

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [djs, setDjs] = useState<HomeDJ[]>([]);
  const [loadingDJs, setLoadingDJs] = useState(true);

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
    <main className="min-h-screen overflow-hidden bg-canvas text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-160px] top-[-160px] h-[420px] w-[420px] rounded-full bg-green-500/10 blur-[140px]" />

        <div className="absolute right-[-220px] top-[260px] h-[520px] w-[520px] rounded-full bg-green-500/10 blur-[160px]" />
      </div>

      <Navbar />

      <Hero />

      <SearchStation
  search={search}
  setSearch={setSearch}
  loadingDJs={loadingDJs}
  filteredDJs={filteredDJs}
/>

      <FeatureCards
  features={featureCards}
/>

      <HowItWorks
  steps={howItWorks}
/>

      <ProductShowcase />

      <CTA />

      <Footer />
    </main>
  );
}

