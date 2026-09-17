import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppProviders } from "@/components/providers";
import { captureInstallPrompt } from "@/lib/pwa-install";
import { useEffect } from "react";
import appCss from "../styles.css?url";

const APP_NAME = "WatchBoard";

function isPublicShareHost(host: string): boolean {
  if (!host || !/^[a-z0-9.-]+$/.test(host) || !host.includes(".")) return false;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;
  if (
    host === "vercel.app" ||
    host.endsWith(".vercel.app") ||
    host === "vercel.com" ||
    host.endsWith(".vercel.com")
  ) {
    return false;
  }
  return true;
}

function publicShareHost(): string {
  const published = String(import.meta.env.VITE_PUBLIC_HOSTNAME ?? "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
  if (isPublicShareHost(published)) return published;
  if (typeof window !== "undefined") {
    const fromWindow = window.location.host.toLowerCase().replace(/:\d+$/, "");
    if (isPublicShareHost(fromWindow)) return fromWindow;
  }
  return "";
}

const fetchSessionUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("@/lib/auth/verify.server");
  const u = await getSessionUser();
  return u ? { id: u.id, email: u.email } : null;
});

export const Route = createRootRoute({
  beforeLoad: async () => ({ sessionUser: await fetchSessionUser() }),
  head: () => {
    const host = publicShareHost();
    const origin = host ? `https://${host}` : "";
    const ogImage = origin ? `${origin}/og.jpg` : "";
    const xBanner = origin ? `${origin}/x-banner.jpg` : "";
    const description =
      "Zone assignments, sendable watch lists, days-off requests, and the leave calendar for the shift.";
    const imageAlt = "WatchBoard — stacked silver WATCH and lime BOARD on a night topographic map.";
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: APP_NAME },
        { name: "description", content: description },
        { name: "theme-color", content: "#0c0d0f" },
        { name: "application-name", content: APP_NAME },
        { name: "apple-mobile-web-app-title", content: APP_NAME },
        { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
        { name: "mobile-web-app-capable", content: "yes" },
        { property: "og:locale", content: "en_US" },
        { property: "og:image:alt", content: imageAlt },
        { property: "og:image:type", content: "image/jpeg" },
        { name: "twitter:image:alt", content: imageAlt },
        { name: "twitter:image:width", content: "1200" },
        { name: "twitter:image:height", content: "630" },
        ...(ogImage
          ? [
              { property: "og:image:secure_url", content: ogImage },
              { property: "og:image:url", content: ogImage },
            ]
          : []),
        ...(xBanner ? [{ property: "x:game:image", content: xBanner }] : []),
      ],
      links: [
        { rel: "icon", type: "image/png", href: "/icon-192.png" },
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
        { rel: "manifest", href: "/manifest.webmanifest" },
        { rel: "stylesheet", href: appCss },
        { rel: "manifest", href: "/__grok/manifest.webmanifest" },
        { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
        ...(ogImage ? [{ rel: "image_src", href: ogImage }] : []),
        ...(origin ? [{ rel: "canonical", href: `${origin}/` }] : []),
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap",
        },
      ],
    };
  },
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground">
        <PreviewHostBridge />
        <InstallCapture />
        <AuthProvider>
          <AppProviders>
            <Outlet />
          </AppProviders>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}

function InstallCapture() {
  useEffect(() => captureInstallPrompt(), []);
  return null;
}
