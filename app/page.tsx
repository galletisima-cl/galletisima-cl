"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CartDrawer from "../components/CartDrawer";
import MobileCategoryAccordions from "../components/MobileCategoryAccordions";
import { createClient } from "../lib/supabase/client";
import { CART_UPDATED_EVENT, readCartCount } from "../lib/cart";
import { DEFAULT_HERO_CONTENT, HERO_SETTING_KEYS } from "../lib/hero-content";
import { createWhatsappUrl } from "../lib/whatsapp";

type Category = { id: string; name: string; slug: string };
type CategoryFeatureBanner = { categoryId: string; imageUrl: string; mobileImageUrl?: string };
type NavigationLink = { id: string; label: string; href: string };
type NavigationConfig = { menus: { id: string; label: string }[]; links?: NavigationLink[]; itemOrder?: string[]; categoryMenu: Record<string, string>; categoryOrder: string[] };
const defaultLinks: NavigationLink[] = [{ id: "home", label: "Inicio", href: "#inicio" }, { id: "altars", label: "Altares", href: "/?buscar=altares#catalogo" }, { id: "tools", label: "Herramientas", href: "/?buscar=herramientas#catalogo" }, { id: "all", label: "Ver todo", href: "/?ver=todos#catalogo" }, { id: "more", label: "Más", href: "/contacto" }];
const defaultNavigation: NavigationConfig = { menus: [{ id: "celebrations", label: "Celebraciones" }, { id: "characters", label: "Personajes" }, { id: "themes", label: "Temáticas" }], links: defaultLinks, itemOrder: ["link:home", "menu:celebrations", "menu:characters", "menu:themes", "link:altars", "link:tools", "link:all", "link:more"], categoryMenu: {}, categoryOrder: [] };

const fallbackCategories: Category[] = [
  { id: "navidad", name: "Todo Navidad", slug: "todo-navidad" },
  { id: "baby-shower", name: "Todo Baby Shower", slug: "todo-baby-shower" },
  { id: "halloween", name: "Todo Halloween", slug: "todo-halloween" },
  { id: "stitch", name: "Todo Stitch", slug: "todo-stitch" },
  { id: "pokemon", name: "Todo Pokemon", slug: "todo-pokemon" },
  { id: "futbol", name: "Todo Futbol", slug: "todo-futbol" },
];

const groupMatchers = {
  celebrations: ["navidad", "baby-shower", "halloween", "ninos", "papa", "mama", "celebracion", "fiestas-patrias", "bebes"],
  characters: ["toy", "snoopy", "stitch", "pokemon", "bluey", "gabby", "marvel", "pooh", "disney", "bob-esponja", "pawpatrol", "spiderman", "lilo", "netflix"],
};

function displayCategory(name: string) {
  return name.replace(/^Todo\s+/i, "").replace(/Pokemon/i, "Pokémon").replace(/Futbol/i, "Fútbol").replace(/Superheroes/i, "Superhéroes").replace(/ToyStory/i, "Toy Story").replace(/Winie The Pooh/i, "Winnie the Pooh").replace(/FoodHall/i, "Food Hall").replace(/LiLo-Stitch/i, "Lilo & Stitch");
}

function categoryHref(slug: string) {
  return `/categoria/${encodeURIComponent(slug)}`;
}

function groupCategories(categories: Category[]) {
  const celebrations: Category[] = [];
  const characters: Category[] = [];
  const themes: Category[] = [];
  categories.forEach((category) => {
    if (groupMatchers.celebrations.some((term) => category.slug.includes(term))) celebrations.push(category);
    else if (groupMatchers.characters.some((term) => category.slug.includes(term))) characters.push(category);
    else themes.push(category);
  });
  return { celebrations, characters, themes };
}

type PublicProduct = {
  id: string;
  slug: string;
  name: string;
  size: string;
  price: number;
  image_url: string;
  featured: boolean;
  product_categories?: { category_id: string }[];
  pos?: string;
};

const fallbackProducts: PublicProduct[] = [
  { id: "demo-1", slug: "oso-tierno", name: "Oso Tierno", size: "8 cm", price: 3990, image_url: "", featured: true, pos: "58% 84%" },
  { id: "demo-2", slug: "flor-vintage", name: "Flor Vintage", size: "7 cm", price: 3490, image_url: "", featured: false, pos: "72% 10%" },
  { id: "demo-3", slug: "arcoiris", name: "Arcoíris", size: "9 cm", price: 3490, image_url: "", featured: true, pos: "45% 48%" },
  { id: "demo-4", slug: "dino-rex", name: "Dino Rex", size: "10 cm", price: 3990, image_url: "", featured: false, pos: "78% 45%" },
  { id: "demo-5", slug: "corazon-clasico", name: "Corazón Clásico", size: "6 cm", price: 2990, image_url: "", featured: false, pos: "90% 23%" },
  { id: "demo-6", slug: "flor-de-primavera", name: "Flor de Primavera", size: "7 cm", price: 3490, image_url: "", featured: false, pos: "82% 82%" },
];

const currency = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});
const CAROUSEL_SPEED_PX_PER_SECOND = 32;
const CAROUSEL_MANUAL_PAUSE_MS = 5000;

function useContinuousCarousel(carouselRef: { current: HTMLDivElement | null }, itemCount: number) {
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel || itemCount === 0) return;
    let frameId = 0;
    let previousTime = 0;
    let interacting = false;
    let activePointerId: number | null = null;
    let dragStartX = 0;
    let dragStartScrollLeft = 0;
    let dragged = false;
    let suppressClickUntil = 0;
    let resumeAt = 0;
    const cycleMarkers = () => ({
      middle: carousel.querySelector<HTMLElement>('[data-carousel-copy="1"]')?.offsetLeft || 0,
      third: carousel.querySelector<HTMLElement>('[data-carousel-copy="2"]')?.offsetLeft || 0,
    });
    const startAtMiddle = window.requestAnimationFrame(() => {
      const { middle } = cycleMarkers();
      if (middle) carousel.scrollLeft = middle;
    });
    const animate = (time: number) => {
      const elapsed = previousTime ? Math.min(time - previousTime, 50) : 0;
      previousTime = time;
      if (!interacting && performance.now() >= resumeAt && carousel.scrollWidth > carousel.clientWidth + 2) {
        carousel.scrollLeft += CAROUSEL_SPEED_PX_PER_SECOND * elapsed / 1000;
        const { middle, third } = cycleMarkers();
        const cycleWidth = third - middle;
        if (cycleWidth > 0 && carousel.scrollLeft >= third) carousel.scrollLeft -= cycleWidth;
        else if (cycleWidth > 0 && carousel.scrollLeft <= 1) carousel.scrollLeft += cycleWidth;
      }
      frameId = window.requestAnimationFrame(animate);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      interacting = true;
      activePointerId = event.pointerId;
      dragStartX = event.clientX;
      dragStartScrollLeft = carousel.scrollLeft;
      dragged = false;
      carousel.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!interacting || event.pointerId !== activePointerId) return;
      const distance = event.clientX - dragStartX;
      if (Math.abs(distance) > 4) dragged = true;
      if (dragged) {
        event.preventDefault();
        carousel.scrollLeft = dragStartScrollLeft - distance;
      }
    };
    const onPointerUp = (event: PointerEvent) => {
      if (activePointerId !== null && event.pointerId !== activePointerId) return;
      if (activePointerId !== null && carousel.hasPointerCapture(activePointerId)) carousel.releasePointerCapture(activePointerId);
      if (dragged) {
        suppressClickUntil = performance.now() + 250;
        resumeAt = performance.now() + CAROUSEL_MANUAL_PAUSE_MS;
      }
      interacting = false;
      activePointerId = null;
      previousTime = performance.now();
    };
    const onClick = (event: MouseEvent) => {
      if (performance.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    carousel.addEventListener("pointerdown", onPointerDown);
    carousel.addEventListener("pointermove", onPointerMove, { passive: false });
    carousel.addEventListener("click", onClick, true);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    frameId = window.requestAnimationFrame(animate);
    return () => {
      window.cancelAnimationFrame(startAtMiddle);
      window.cancelAnimationFrame(frameId);
      carousel.removeEventListener("pointerdown", onPointerDown);
      carousel.removeEventListener("pointermove", onPointerMove);
      carousel.removeEventListener("click", onClick, true);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [carouselRef, itemCount]);
}

function DesktopCategoryMenu({ label, menuKey, categories, openMenu, setOpenMenu, alignRight = false }: { label: string; menuKey: string; categories: Category[]; openMenu: string | null; setOpenMenu: (key: string | null) => void; alignRight?: boolean }) {
  const open = openMenu === menuKey;
  return <div className={`mega-menu ${alignRight ? "align-right" : ""}`}><button className="nav-pill" aria-expanded={open} aria-controls={`mega-${menuKey}`} onClick={() => setOpenMenu(open ? null : menuKey)}>{label}<span aria-hidden="true">⌄</span></button>{open && <div className="mega-panel" id={`mega-${menuKey}`}><div className="mega-title"><small>Explorar</small><strong>{label}</strong></div><div className="mega-links">{categories.map((category) => <a key={category.id} href={categoryHref(category.slug)} onClick={() => setOpenMenu(null)}>{displayCategory(category.name)}<span>→</span></a>)}</div></div>}</div>;
}

function FeaturedCategoryBanner({ banner, category, products }: { banner: CategoryFeatureBanner; category: Category; products: PublicProduct[] }) {
  const carouselRef = useRef<HTMLDivElement>(null);
  useContinuousCarousel(carouselRef, products.length);
  const move = useCallback((direction: -1 | 1) => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    const card = carousel.querySelector<HTMLElement>(".featured-product-card");
    const gap = Number.parseFloat(window.getComputedStyle(carousel).gap) || 0;
    carousel.scrollBy({ left: direction * ((card?.offsetWidth || 190) + gap), behavior: "smooth" });
  }, []);

  return (
    <article
      className="category-feature-banner"
      style={{ "--feature-desktop": `url(${banner.imageUrl})`, "--feature-mobile": banner.mobileImageUrl ? `url(${banner.mobileImageUrl})` : undefined } as React.CSSProperties}
    >
      <span className="category-feature-copy">
        <small>Categoría destacada</small>
        <strong>{displayCategory(category.name)}</strong>
        <Link href={categoryHref(category.slug)}>Ver colección →</Link>
      </span>
      {products.length > 0 && <div className="featured-products-wrap">
        <div className="featured-products-controls">
          <button type="button" aria-label={`Ver productos anteriores de ${displayCategory(category.name)}`} onClick={() => move(-1)}>←</button>
          <button type="button" aria-label={`Ver más productos de ${displayCategory(category.name)}`} onClick={() => move(1)}>→</button>
        </div>
        <div
          className="featured-products-carousel continuous-carousel"
          ref={carouselRef}
          aria-label={`Productos de ${displayCategory(category.name)}`}
        >
          {[0, 1, 2].flatMap((copy) => products.map((product, index) => <Link className="featured-product-card" data-carousel-copy={index === 0 ? copy : undefined} aria-hidden={copy !== 1} tabIndex={copy === 1 ? undefined : -1} key={`${copy}-${product.id}`} href={`/producto/${product.slug}`}>
            <span><img src={product.image_url} alt={product.name} loading="lazy" /></span>
            <strong>{product.name}</strong>
            <small>desde {currency.format(product.price)}</small>
          </Link>))}
        </div>
      </div>}
    </article>
  );
}

export default function Home() {
  const [cart, setCart] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [whatsappMessageOpen, setWhatsappMessageOpen] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState("56975265959");
  const [heroBannerUrl, setHeroBannerUrl] = useState("");
  const [heroMobileBannerUrl, setHeroMobileBannerUrl] = useState("");
  const [heroContent, setHeroContent] = useState(DEFAULT_HERO_CONTENT);
  const [categoryBannerUrls, setCategoryBannerUrls] = useState<Record<string, string>>({});
  const [categoryMobileBannerUrls, setCategoryMobileBannerUrls] = useState<Record<string, string>>({});
  const [categoryFeatureBanners, setCategoryFeatureBanners] = useState<CategoryFeatureBanner[]>([]);
  const [navigationConfig, setNavigationConfig] = useState<NavigationConfig>(defaultNavigation);
  const [allProducts, setAllProducts] = useState<PublicProduct[]>([]);
  const [catalogPage, setCatalogPage] = useState(1);
  const [seasonalCategoryId, setSeasonalCategoryId] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [menuSearch, setMenuSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [productSort, setProductSort] = useState("name-asc");
  const [catalogCategories, setCatalogCategories] = useState<Category[]>(fallbackCategories);
  const [openDesktopMenu, setOpenDesktopMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const seasonalCarouselRef = useRef<HTMLDivElement>(null);
  const celebrationsCarouselRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const filteredProducts = useMemo(() => {
    const selectedCategory = catalogCategories.find((category) => category.slug === categoryFilter);
    const search = productSearch.trim().toLocaleLowerCase("es");
    const products = allProducts.filter((product) => {
      const matchesSearch = !search || product.name.toLocaleLowerCase("es").includes(search);
      const matchesCategory = !selectedCategory || product.product_categories?.some((link) => link.category_id === selectedCategory.id);
      return matchesSearch && matchesCategory;
    });
    return products.sort((a, b) => {
      if (productSort === "price-asc") return a.price - b.price;
      if (productSort === "price-desc") return b.price - a.price;
      if (productSort === "name-desc") return b.name.localeCompare(a.name, "es");
      return a.name.localeCompare(b.name, "es");
    });
  }, [allProducts, catalogCategories, categoryFilter, productSearch, productSort]);
  const visibleMenuCategories = catalogCategories.filter((category) => !/^AA-Prueba/i.test(category.name) && category.name.toLocaleLowerCase("es").includes(menuSearch.trim().toLocaleLowerCase("es")));

  useEffect(() => {
    const initialSync = window.setTimeout(() => setCart(readCartCount()), 0);
    const syncCart = (event: Event) => setCart((event as CustomEvent<number>).detail ?? readCartCount());
    window.addEventListener(CART_UPDATED_EVENT, syncCart);
    window.addEventListener("storage", syncCart);
    return () => {
      window.clearTimeout(initialSync);
      window.removeEventListener(CART_UPDATED_EVENT, syncCart);
      window.removeEventListener("storage", syncCart);
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("site_settings").select("key,value").in("key", ["whatsapp_number", "hero_banner_url", "hero_mobile_banner_url", ...Object.values(HERO_SETTING_KEYS), "category_banner_urls", "category_mobile_banner_urls", "category_feature_banners", "category_navigation", "seasonal_category_id", "instagram_url"]),
      supabase.from("categories").select("id,name,slug").eq("active", true).order("name"),
      supabase
        .from("products")
        .select("id,slug,name,size,price,image_url,featured,product_categories(category_id)")
        .eq("active", true)
        .order("name"),
    ]).then(([settingsResult, categoriesResult, allProductsResult]) => {
      const settings = Object.fromEntries((settingsResult.data || []).map((setting) => [setting.key, setting.value]));
      if (settings.whatsapp_number) setWhatsappNumber(settings.whatsapp_number);
      if (settings.hero_banner_url) setHeroBannerUrl(settings.hero_banner_url);
      if (settings.hero_mobile_banner_url) setHeroMobileBannerUrl(settings.hero_mobile_banner_url);
      setHeroContent({
        eyebrow: settings[HERO_SETTING_KEYS.eyebrow] || DEFAULT_HERO_CONTENT.eyebrow,
        title: settings[HERO_SETTING_KEYS.title] || DEFAULT_HERO_CONTENT.title,
        subtitle: settings[HERO_SETTING_KEYS.subtitle] || DEFAULT_HERO_CONTENT.subtitle,
        primaryButton: settings[HERO_SETTING_KEYS.primaryButton] || DEFAULT_HERO_CONTENT.primaryButton,
        secondaryButton: settings[HERO_SETTING_KEYS.secondaryButton] || DEFAULT_HERO_CONTENT.secondaryButton,
      });
      if (settings.seasonal_category_id) setSeasonalCategoryId(settings.seasonal_category_id);
      if (settings.instagram_url) setInstagramUrl(settings.instagram_url);
      if (settings.category_banner_urls) {
        try {
          setCategoryBannerUrls(JSON.parse(settings.category_banner_urls));
        } catch {
          setCategoryBannerUrls({});
        }
      }
      if (settings.category_mobile_banner_urls) {
        try { setCategoryMobileBannerUrls(JSON.parse(settings.category_mobile_banner_urls)); } catch { setCategoryMobileBannerUrls({}); }
      }
      if (settings.category_feature_banners) {
        try {
          setCategoryFeatureBanners(JSON.parse(settings.category_feature_banners));
        } catch {
          setCategoryFeatureBanners([]);
        }
      }
      if (settings.category_navigation) {
        try { setNavigationConfig(JSON.parse(settings.category_navigation)); } catch { setNavigationConfig(defaultNavigation); }
      }
      if (categoriesResult.data?.length) setCatalogCategories(categoriesResult.data);
      if (allProductsResult.data) {
        const searchParams = new URLSearchParams(window.location.search);
        const selectedSlug = searchParams.get("ver") === "todos" ? null : searchParams.get("categoria");
        const initialSearch = searchParams.get("buscar") || "";
        setCategoryFilter(selectedSlug || "");
        setProductSearch(initialSearch);
        setAllProducts(allProductsResult.data);
        setCatalogPage(1);
      }
    });
  }, []);

  useEffect(() => {
    const refreshHeroAfterReturn = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      const supabase = createClient();
      void supabase
        .from("site_settings")
        .select("key,value")
        .in("key", ["hero_banner_url", "hero_mobile_banner_url"])
        .then(({ data }) => {
          const settings = Object.fromEntries((data || []).map((setting) => [setting.key, setting.value]));
          setHeroBannerUrl(settings.hero_banner_url || "");
          setHeroMobileBannerUrl(settings.hero_mobile_banner_url || "");
        });
    };
    window.addEventListener("pageshow", refreshHeroAfterReturn);
    return () => window.removeEventListener("pageshow", refreshHeroAfterReturn);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    const closeDesktopMenu = (event: MouseEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setOpenDesktopMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenDesktopMenu(null);
    };
    document.addEventListener("pointerdown", closeDesktopMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeDesktopMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const publicCategories = catalogCategories.filter((category) => !/^AA-Prueba/i.test(category.name));
  const categoryGroups = groupCategories(publicCategories);
  const orderedCategories = [...publicCategories].sort((a, b) => {
    const ai = navigationConfig.categoryOrder.indexOf(a.id);
    const bi = navigationConfig.categoryOrder.indexOf(b.id);
    return (ai < 0 ? 9999 : ai) - (bi < 0 ? 9999 : bi) || a.name.localeCompare(b.name, "es");
  });
  const navLink = (id: string) => navigationConfig.links?.find((item) => item.id === id) || defaultLinks.find((item) => item.id === id)!;
  const publicNavOrder = navigationConfig.itemOrder || defaultNavigation.itemOrder!;
  const closeMobileMenu = () => setMenuOpen(false);
  const closeCart = useCallback(() => setCartOpen(false), []);
  const seasonalCategory = publicCategories.find((category) => category.id === seasonalCategoryId) || publicCategories.find((category) => /fiestas patrias/i.test(category.name));
  const seasonalProducts = seasonalCategory ? allProducts.filter((product) => product.product_categories?.some((link) => link.category_id === seasonalCategory.id) && product.image_url) : [];
  const celebrationsMenu = navigationConfig.menus.find((menu) => /celebr/i.test(menu.label));
  const celebrationCategories = orderedCategories.filter((category) => celebrationsMenu && navigationConfig.categoryMenu[category.id] === celebrationsMenu.id);
  useContinuousCarousel(seasonalCarouselRef, seasonalProducts.length);
  useContinuousCarousel(celebrationsCarouselRef, celebrationCategories.length);
  const categoryImage = (category: Category) => categoryBannerUrls[category.id] || allProducts.find((product) => product.image_url && product.product_categories?.some((link) => link.category_id === category.id))?.image_url || "";
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / 50));
  const pageProducts = filteredProducts.slice((catalogPage - 1) * 50, catalogPage * 50);
  const goToCatalogPage = (page: number) => { setCatalogPage(Math.max(1, Math.min(page, pageCount))); document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  return (
    <main>
      <div className="benefit-bar">
        <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.75h11.5v10H3zM14.5 10h3.25L21 13.25v3.5h-6.5z"/><path d="M7.25 19a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Zm10.5 0a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z"/></svg><b>Envíos a todo Chile</b></span>
        <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 10.5-10.5M12.75 5.75l5.5 5.5M15.5 3l.6 1.9L18 5.5l-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6.6-1.9ZM7 7l.45 1.55L9 9l-1.55.45L7 11l-.45-1.55L5 9l1.55-.45L7 7Z"/></svg><b>Moldes personalizados</b></span>
        <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5.4c0 4.6-3.1 7.7-8 9.6-4.9-1.9-8-5-8-9.6V6l8-3Z"/><path d="m8.5 12 2.25 2.25L15.75 9"/></svg><b>Compra 100% segura</b></span>
      </div>

      <header className="header shell">
        <nav className="desktop-nav" aria-label="Navegación principal" ref={navRef}>
          {publicNavOrder.map((entry, index) => {
            if (entry.startsWith("link:")) {
              const id = entry.slice(5), link = navLink(id);
              const assignedCategories = orderedCategories.filter((category) => navigationConfig.categoryMenu[category.id] === entry);
              if (id !== "home" && assignedCategories.length) return <DesktopCategoryMenu key={entry} label={link.label} menuKey={entry} categories={assignedCategories} openMenu={openDesktopMenu} setOpenMenu={setOpenDesktopMenu} alignRight={index >= publicNavOrder.length - 2} />;
              if (id === "more") return <div className="mega-menu align-right" key={entry}><button className="nav-pill" type="button" aria-expanded={openDesktopMenu === "more"} aria-controls="mega-more" onClick={() => setOpenDesktopMenu(openDesktopMenu === "more" ? null : "more")}>{link.label} <span aria-hidden="true">⌄</span></button>{openDesktopMenu === "more" && <div className="mega-panel more-panel" id="mega-more"><div className="mega-links"><Link href="/contacto" onClick={() => setOpenDesktopMenu(null)}>Contacto <span>→</span></Link><Link href="/terminos-y-condiciones" onClick={() => setOpenDesktopMenu(null)}>Términos y Condiciones <span>→</span></Link><Link href="/politica-de-reembolso" onClick={() => setOpenDesktopMenu(null)}>Política de reembolso <span>→</span></Link><Link href="/politica-de-privacidad" onClick={() => setOpenDesktopMenu(null)}>Política de privacidad <span>→</span></Link></div></div>}</div>;
              return <Link key={entry} className={`nav-pill ${id === "all" ? "nav-all" : ""}`} href={link.href} onClick={id === "all" ? () => { setCategoryFilter(""); setCatalogPage(1); } : undefined}>{link.label}</Link>;
            }
            const menu = navigationConfig.menus.find((item) => `menu:${item.id}` === entry);
            if (!menu) return null;
            const menuCategories = orderedCategories.filter((category) => {
              if (Object.prototype.hasOwnProperty.call(navigationConfig.categoryMenu, category.id)) return navigationConfig.categoryMenu[category.id] === menu.id;
              return (categoryGroups[menu.id as keyof typeof categoryGroups] || []).some((fallbackCategory) => fallbackCategory.id === category.id);
            });
            return <DesktopCategoryMenu key={menu.id} label={menu.label} menuKey={menu.id} categories={menuCategories} openMenu={openDesktopMenu} setOpenMenu={setOpenDesktopMenu} alignRight={index >= navigationConfig.menus.length - 1} />;
          })}
        </nav>
        <button className="category-trigger" aria-label="Abrir categorías" aria-expanded={menuOpen} aria-controls="mobile-category-drawer" onClick={() => setMenuOpen(true)}>
          <span aria-hidden="true">☰</span>
        </button>
        <a className="brand" href="#inicio" aria-label="Galletísima, inicio">
          <Image src="/galletisima-logo.png" alt="Galletísima" width={360} height={140} priority />
        </a>
        <div className="header-actions">
          <form className="header-search" onSubmit={(event) => { event.preventDefault(); setCatalogPage(1); document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
            <input type="search" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Busque productos aquí..." aria-label="Buscar productos" />
            <button type="submit" aria-label="Buscar">⌕</button>
          </form>
          <button className="icon-button cart" aria-label={`Abrir carrito con ${cart} productos`} onClick={() => setCartOpen(true)}>
            🛒<em>{cart}</em>
          </button>
        </div>
        {menuOpen && <div className="drawer-layer"><button className="drawer-backdrop" aria-label="Cerrar categorías" onClick={closeMobileMenu} /><nav id="mobile-category-drawer" className="category-drawer" aria-label="Categorías"><div className="drawer-head"><div><small>Explora la tienda</small><strong>Categorías</strong></div><button aria-label="Cerrar categorías" onClick={closeMobileMenu}>×</button></div><form className="drawer-search" onSubmit={(event) => { event.preventDefault(); setProductSearch(menuSearch); setCatalogPage(1); closeMobileMenu(); document.getElementById("catalogo")?.scrollIntoView({behavior:"smooth"}); }}><label htmlFor="home-drawer-search">Buscar productos o categorías</label><div><input id="home-drawer-search" type="search" value={menuSearch} onChange={(event) => setMenuSearch(event.target.value)} placeholder="¿Qué molde buscas?" autoComplete="off"/><button type="submit" aria-label="Buscar productos">⌕</button></div></form><a className="drawer-direct" href="#inicio" onClick={closeMobileMenu}>Inicio <span>→</span></a><MobileCategoryAccordions categories={visibleMenuCategories} navigation={navigationConfig} close={closeMobileMenu} />{!visibleMenuCategories.length && <p className="drawer-search-empty">No hay categorías con ese nombre. Presiona buscar para revisar los productos.</p>}<Link className="drawer-direct" href="/contacto" onClick={closeMobileMenu}>Contacto <span>→</span></Link></nav></div>}
      </header>
      <CartDrawer open={cartOpen} onClose={closeCart} />

      <section id="inicio" className="hero">
        <div
          className="hero-image"
          style={{ "--hero-desktop": heroBannerUrl ? `url(${heroBannerUrl})` : "none", "--hero-mobile": heroMobileBannerUrl ? `url(${heroMobileBannerUrl})` : heroBannerUrl ? `url(${heroBannerUrl})` : "none" } as React.CSSProperties}
          role="img"
          aria-label="Moldes y galletas decoradas sobre el banner principal"
        />
        <div className="hero-content shell">
          <p className="eyebrow">{heroContent.eyebrow}</p>
          <h1>{heroContent.title}</h1>
          <p className="hero-copy">{heroContent.subtitle}</p>
          <div className="hero-buttons">
            <Link className="button primary" href="/?ver=todos#catalogo" onClick={() => { setCategoryFilter(""); setCatalogPage(1); }}>{heroContent.primaryButton} <span>→</span></Link>
            <a
              className="button secondary"
              href={createWhatsappUrl(whatsappNumber)}
              target="_blank"
              rel="noreferrer"
            >
              {heroContent.secondaryButton} <span>→</span>
            </a>
          </div>
        </div>
        <div className="hero-note"><span aria-hidden="true">✦</span><small>Hechos para</small><strong>crear momentos</strong><b>únicos</b></div>
      </section>

      {seasonalCategory && seasonalProducts.length > 0 && (
        <section className="category-carousel-section seasonal-section" aria-labelledby="seasonal-title">
          <div className="shell category-carousel-heading">
            <div>
              <p className="eyebrow">TEMPORADA DE TURNO</p>
              <h2 id="seasonal-title">{displayCategory(seasonalCategory.name)}</h2>
            </div>
            <div className="category-carousel-controls">
              <button type="button" aria-label="Ver productos anteriores" onClick={() => seasonalCarouselRef.current?.scrollBy({ left: -420, behavior: "smooth" })}>←</button>
              <button type="button" aria-label="Ver más productos" onClick={() => seasonalCarouselRef.current?.scrollBy({ left: 420, behavior: "smooth" })}>→</button>
            </div>
          </div>
          <div className="category-carousel shell seasonal-carousel continuous-carousel" ref={seasonalCarouselRef} aria-label={`Productos de ${displayCategory(seasonalCategory.name)}`}>
            {[0, 1, 2].flatMap((copy) => seasonalProducts.map((product, index) => <Link className="category-carousel-card" data-carousel-copy={index === 0 ? copy : undefined} aria-hidden={copy !== 1} tabIndex={copy === 1 ? undefined : -1} key={`${copy}-${product.id}`} href={`/producto/${product.slug}`}><picture><img src={product.image_url} alt={product.name} loading="lazy" /></picture><strong>{product.name}</strong><small>Ver producto →</small></Link>))}
          </div>
        </section>
      )}

      {categoryFeatureBanners.some((banner) => banner.imageUrl && banner.categoryId) && (
        <section className="category-feature-stack shell" aria-label="Categorías destacadas">
          {categoryFeatureBanners.map((banner, index) => {
            const category = catalogCategories.find((item) => item.id === banner.categoryId);
            if (!category || !banner.imageUrl) return null;
            const products = allProducts.filter((product) => product.image_url && product.product_categories?.some((link) => link.category_id === category.id));
            return <FeaturedCategoryBanner banner={banner} category={category} products={products} key={`${banner.categoryId}-${index}`} />;
          })}
        </section>
      )}

      {celebrationCategories.length > 0 && (
        <section className="category-carousel-section celebrations-section" aria-labelledby="celebrations-title">
          <div className="shell category-carousel-heading"><div><p className="eyebrow">CELEBRA A TU MANERA</p><h2 id="celebrations-title">Celebraciones</h2></div><div className="category-carousel-controls"><button type="button" aria-label="Ver anteriores" onClick={() => celebrationsCarouselRef.current?.scrollBy({ left: -420, behavior: "smooth" })}>←</button><button type="button" aria-label="Ver más" onClick={() => celebrationsCarouselRef.current?.scrollBy({ left: 420, behavior: "smooth" })}>→</button></div></div>
          <div className="category-carousel shell continuous-carousel" ref={celebrationsCarouselRef}>{[0, 1, 2].flatMap((copy) => celebrationCategories.map((category, index) => { const image = categoryImage(category); return <Link className="category-carousel-card" data-carousel-copy={index === 0 ? copy : undefined} aria-hidden={copy !== 1} tabIndex={copy === 1 ? undefined : -1} key={`${copy}-${category.id}`} href={categoryHref(category.slug)} onClick={() => { setCategoryFilter(category.slug); setCatalogPage(1); }}><picture>{categoryMobileBannerUrls[category.id] && <source media="(max-width: 650px)" srcSet={categoryMobileBannerUrls[category.id]} />}{image ? <img src={image} alt={displayCategory(category.name)} loading="lazy" /> : <span className="category-image-placeholder">♡</span>}</picture><strong>{displayCategory(category.name)}</strong><small>Ver colección →</small></Link>; }))}</div>
        </section>
      )}

      <section className="all-categories-section shell" aria-labelledby="all-categories-title">
        <p className="eyebrow">TODAS LAS COLECCIONES</p><h2 id="all-categories-title">Encuentra tu molde perfecto</h2>
        <div className="all-categories-grid">{orderedCategories.map((category) => { const image = categoryImage(category); return <Link key={category.id} href={categoryHref(category.slug)} onClick={() => { setCategoryFilter(category.slug); setCatalogPage(1); }}><span>{image ? <img src={image} alt="" loading="lazy" /> : <b>♡</b>}</span><strong>{displayCategory(category.name)}</strong></Link>; })}</div>
      </section>

      <section className="instagram-section shell" aria-labelledby="instagram-title"><div><p className="eyebrow">INSPÍRATE CON NOSOTROS</p><h2 id="instagram-title">Galletísima en Instagram</h2><p>Nuevos diseños, ideas para decorar y novedades de la tienda.</p></div>{instagramUrl ? <a className="button primary" href={instagramUrl} target="_blank" rel="noreferrer">VER INSTAGRAM <span>↗</span></a> : <span className="instagram-pending">Agrega el perfil desde el panel administrador</span>}</section>

      <section id="catalogo" className="section catalog-section shell">
        <p className="eyebrow catalog-eyebrow">CATÁLOGO COMPLETO</p>
        <h2>Todos nuestros moldes</h2>
        <div className="title-line" />
        <div className="catalog-filters">
          <label className="catalog-search"><span>Buscar</span><input ref={searchInputRef} id="catalog-search-input" type="search" value={productSearch} onChange={(event) => { setProductSearch(event.target.value); setCatalogPage(1); }} placeholder="Nombre del molde…" /></label>
          <label><span>Categoría</span><select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setCatalogPage(1); }}><option value="">Todas las categorías</option>{publicCategories.map((category) => <option key={category.id} value={category.slug}>{displayCategory(category.name)}</option>)}</select></label>
          <label><span>Ordenar</span><select value={productSort} onChange={(event) => { setProductSort(event.target.value); setCatalogPage(1); }}><option value="name-asc">Nombre A–Z</option><option value="name-desc">Nombre Z–A</option><option value="price-asc">Precio menor a mayor</option><option value="price-desc">Precio mayor a menor</option></select></label>
          <button type="button" onClick={() => setCatalogPage(1)}>Buscar</button>
        </div>
        <p className="catalog-count">{filteredProducts.length} {filteredProducts.length === 1 ? "producto" : "productos"}</p>
        <div className="product-grid">
          {pageProducts.map((product) => {
            return <article className="product-card" key={product.id}>
              <Link className={`product-photo ${product.image_url ? "has-product-image" : ""}`} href={`/producto/${product.slug}`} aria-label={`Ver ${product.name}`} style={{ backgroundImage: product.image_url ? `url(${product.image_url})` : undefined }}>
                {product.featured && <span className="tag">favorito</span>}
              </Link>
              <div className="product-info">
                <div><h3><Link href={`/producto/${product.slug}`}>{product.name}</Link></h3><strong>{product.price ? currency.format(product.price) : "Consultar"}</strong></div>
                <Link className="product-buy" href={`/producto/${product.slug}`} aria-label={`Comprar ${product.name}`}>Comprar</Link>
              </div>
            </article>;
          })}
        </div>
        {filteredProducts.length > 0 ? <nav className="catalog-pagination" aria-label="Páginas del catálogo"><button type="button" disabled={catalogPage === 1} onClick={() => goToCatalogPage(catalogPage - 1)}>← Anterior</button><span>Página <b>{catalogPage}</b> de {pageCount}</span><button type="button" disabled={catalogPage === pageCount} onClick={() => goToCatalogPage(catalogPage + 1)}>Siguiente →</button></nav> : <div className="catalog-loader"><span>No encontramos productos con estos filtros.</span></div>}
      </section>

      <section className="values">
        <div className="shell value-grid">
          <div><span><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3.5 17.6 9l5.4 1.6-5.4 1.6-1.6 5.4-1.6-5.4L9 10.6 14.4 9 16 3.5Z"/><path d="m24.5 17 .9 3.1 3.1.9-3.1.9-.9 3.1-.9-3.1-3.1-.9 3.1-.9.9-3.1ZM7.5 18l1.1 3.9 3.9 1.1-3.9 1.1L7.5 28l-1.1-3.9L2.5 23l3.9-1.1L7.5 18Z"/></svg></span><p>Diseños únicos<br/><b>y originales</b></p></div>
          <div><span><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3.5 20 6l4.7.2.2 4.7 2.6 4-2.6 4 .2 4.7-4.7.2-4 2.6-4-2.6-4.7-.2-.2-4.7-2.6-4 2.6-4-.2-4.7L12 6l4-2.5Z"/><path d="m11.5 16 3 3 6-6"/></svg></span><p>Materiales de alta<br/><b>calidad y duraderos</b></p></div>
          <div><span><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4.5c-2.8 4.1-6.5 8.3-6.5 13a6.5 6.5 0 0 0 13 0c0-4.7-3.7-8.9-6.5-13Z"/><path d="M21.5 5.5 22.6 9l3.4 1-3.4 1-1.1 3.5-1-3.5-3.5-1 3.5-1 1-3.5Z"/><path d="M12.7 18.5a3.5 3.5 0 0 0 3.3 2.8"/></svg></span><p>Fáciles de usar y<br/><b>fáciles de limpiar</b></p></div>
          <div><span><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 27S5 20.6 5 12.7A6.2 6.2 0 0 1 16 8.8a6.2 6.2 0 0 1 11 3.9C27 20.6 16 27 16 27Z"/><path d="M16 11.5v8M12 15.5h8"/></svg></span><p>Hechos para inspirar<br/><b>tus creaciones</b></p></div>
        </div>
      </section>

      <div className="whatsapp-widget">
        {whatsappMessageOpen && <div className="whatsapp-message" role="status"><span>Si tienes dudas, escríbenos!!!</span><button type="button" aria-label="Cerrar mensaje de WhatsApp" onClick={() => setWhatsappMessageOpen(false)}>×</button></div>}
        <a className="whatsapp" href={createWhatsappUrl(whatsappNumber)} target="_blank" rel="noreferrer" aria-label="Escríbenos por WhatsApp">
          <svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16.04 3A12.9 12.9 0 0 0 5 22.57L3.28 29l6.58-1.72A12.98 12.98 0 1 0 16.04 3Zm0 23.76a10.7 10.7 0 0 1-5.45-1.49l-.39-.23-3.9 1.02 1.04-3.8-.25-.4a10.72 10.72 0 1 1 8.95 4.9Zm5.88-8.03c-.32-.16-1.9-.94-2.2-1.05-.29-.11-.5-.16-.71.16-.22.32-.83 1.05-1.02 1.27-.18.21-.37.24-.69.08-1.89-.94-3.12-1.69-4.37-3.82-.33-.57.33-.53.94-1.76.11-.21.05-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55h-.61c-.22 0-.56.08-.85.4-.29.32-1.12 1.1-1.12 2.66s1.15 3.08 1.3 3.29c.16.21 2.25 3.43 5.45 4.81.76.33 1.36.53 1.82.67.77.24 1.46.21 2.01.13.62-.09 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.14-.29-.22-.61-.38Z"/></svg>
        </a>
      </div>
    </main>
  );
}
