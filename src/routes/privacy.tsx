import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/SiteFooter";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | Clutch Squares" },
      { name: "description", content: "Privacy policy for the Clutch Squares interactive sports squares platform." },
      { property: "og:title", content: "Privacy Policy | Clutch Squares" },
      { property: "og:description", content: "Privacy policy for the Clutch Squares interactive sports squares platform." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 sm:px-8 pt-32 sm:pt-40 pb-24">
        <h1 className="font-display font-bold text-4xl tracking-tight">Privacy Policy</h1>
        <p className="mt-6 text-muted-foreground">
          Our full privacy policy is being finalised and will be published here.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
