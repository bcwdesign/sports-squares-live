import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/SiteFooter";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use | Clutch Squares" },
      { name: "description", content: "Terms of use for the Clutch Squares interactive sports squares platform." },
      { property: "og:title", content: "Terms of Use | Clutch Squares" },
      { property: "og:description", content: "Terms of use for the Clutch Squares interactive sports squares platform." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 sm:px-8 pt-32 sm:pt-40 pb-24">
        <h1 className="font-display font-bold text-4xl tracking-tight">Terms of Use</h1>
        <p className="mt-6 text-muted-foreground">
          Our full terms of use are being finalised and will be published here.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
