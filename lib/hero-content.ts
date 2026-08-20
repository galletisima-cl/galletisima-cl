export const DEFAULT_HERO_CONTENT = {
  eyebrow: "CREA SIN LÍMITES",
  title: "Transforma tus ideas en obras de arte",
  subtitle: "Encuentra el cortador perfecto para tu próxima celebración o diseñemos juntos un molde 100% a tu medida.",
  primaryButton: "VER CATÁLOGO",
  secondaryButton: "PEDIDO PERSONALIZADO",
};

export const HERO_SETTING_KEYS = {
  eyebrow: "hero_eyebrow",
  title: "hero_title",
  subtitle: "hero_subtitle",
  primaryButton: "hero_primary_button",
  secondaryButton: "hero_secondary_button",
} as const;

export type HeroContent = typeof DEFAULT_HERO_CONTENT;
