import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { SiteHeader } from "@/components/home/SiteHeader";
import { Hero } from "@/components/home/Hero";
import { BenefitStrip } from "@/components/home/BenefitStrip";
import { HowItWorks } from "@/components/home/HowItWorks";
import { ExplainSquares } from "@/components/home/ExplainSquares";
import { CorporateSection } from "@/components/home/CorporateSection";
import { AudienceCards } from "@/components/home/AudienceCards";
import { ProductShowcase } from "@/components/home/ProductShowcase";
import { FaqSection } from "@/components/home/FaqSection";
import { FinalCta } from "@/components/home/FinalCta";
import { SiteFooter } from "@/components/home/SiteFooter";

const TITLE = "Clutch Squares | Interactive Sports Squares for Teams & Groups";
const DESCRIPTION =
  "Turn game day into a shared experience with Clutch Squares. Create private football and basketball squares games for companies, teams, groups, friends and events.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://clutchsquares.com/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: "https://clutchsquares.com/" }],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <BenefitStrip />
        <HowItWorks />
        <ExplainSquares />
        <CorporateSection />
        <AudienceCards />
        <ProductShowcase />
        <FaqSection />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
