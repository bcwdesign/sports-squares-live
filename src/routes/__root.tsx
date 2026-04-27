import { Outlet, createRootRoute, HeadContent, Scripts, Link } from "@tanstack/react-router";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display font-bold text-[color:var(--neon-orange)]">404</h1>
        <h2 className="mt-4 text-xl font-bold">Out of bounds</h2>
        <p className="mt-2 text-sm text-muted-foreground">That play doesn't exist on the court.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-[color:var(--neon-blue)] px-4 py-2 text-sm font-bold text-background">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { title: "Clutch Squares — Real-time NBA Squares" },
      { name: "description", content: "Create private NBA Squares games for live watch parties. Real-time scoring, neon UI, second-screen ready." },
      { name: "theme-color", content: "#0a0a0f" },
      { property: "og:title", content: "Clutch Squares — Real-time NBA Squares" },
      { property: "og:description", content: "Create private NBA Squares games for live watch parties. Real-time scoring, neon UI, second-screen ready." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Clutch Squares — Real-time NBA Squares" },
      { name: "twitter:description", content: "Create private NBA Squares games for live watch parties. Real-time scoring, neon UI, second-screen ready." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/19774724-ec17-44bc-a3e7-616244f6b00e" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/19774724-ec17-44bc-a3e7-616244f6b00e" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster theme="dark" position="top-center" />
    </AuthProvider>
  );
}
