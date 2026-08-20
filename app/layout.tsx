import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { createClient } from "@supabase/supabase-js";
import "./globals.css";
import "./admin/admin.css";
import PublicFooter from "../components/PublicFooter";

const fredoka = Fredoka({ subsets: ["latin", "latin-ext"], weight: "variable", variable: "--font-title", display: "swap" });
const nunito = Nunito({ subsets: ["latin", "latin-ext"], weight: "variable", variable: "--font-body", display: "swap" });

async function getInitialHeroImages() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { desktop: "", mobile: "" };
  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    });
    const { data, error } = await supabase
      .from("site_settings")
      .select("key,value")
      .in("key", ["hero_banner_url", "hero_mobile_banner_url"]);
    if (error) return { desktop: "", mobile: "" };
    const settings = Object.fromEntries(
      (data || []).map(({ key: settingKey, value }) => [settingKey, value]),
    );
    return {
      desktop: settings.hero_banner_url || "",
      mobile: settings.hero_mobile_banner_url || settings.hero_banner_url || "",
    };
  } catch {
    return { desktop: "", mobile: "" };
  }
}

export const metadata: Metadata = {
  title: "Galletísima | Moldes que convierten ideas en galletas increíbles",
  description: "Moldes únicos y personalizados para crear galletas inolvidables. Envíos a todo Chile.",
  icons: { icon: "/icon.png", apple: "/apple-icon.png" },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const heroImages = await getInitialHeroImages();
  const initialHeroStyles = {
    "--initial-hero-desktop": heroImages.desktop ? `url(${heroImages.desktop})` : "none",
    "--initial-hero-mobile": heroImages.mobile ? `url(${heroImages.mobile})` : "none",
  } as React.CSSProperties;
  return <html lang="es"><body className={`${nunito.variable} ${fredoka.variable}`} style={initialHeroStyles}>{children}<PublicFooter /></body></html>;
}
