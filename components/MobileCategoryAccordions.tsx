"use client";

import Link from "next/link";
import { useState } from "react";

type Category = { id: string; name: string; slug: string };
type NavigationLink = { id: string; label: string; href: string };
type NavigationConfig = { menus: { id: string; label: string }[]; links?: NavigationLink[]; itemOrder?: string[]; categoryMenu: Record<string, string>; categoryOrder: string[] };
const defaultLinks: NavigationLink[] = [{ id: "home", label: "Inicio", href: "#inicio" }, { id: "altars", label: "Altares", href: "/?buscar=altares#catalogo" }, { id: "tools", label: "Herramientas", href: "/?buscar=herramientas#catalogo" }, { id: "all", label: "Ver todo", href: "/?ver=todos#catalogo" }, { id: "more", label: "Más", href: "/contacto" }];
const defaultNavigation: NavigationConfig = { menus: [{ id: "celebrations", label: "Celebraciones" }, { id: "characters", label: "Personajes" }, { id: "themes", label: "Temáticas" }], links: defaultLinks, itemOrder: ["link:home", "menu:celebrations", "menu:characters", "menu:themes", "link:altars", "link:tools", "link:all", "link:more"], categoryMenu: {}, categoryOrder: [] };
const celebrations = ["navidad", "baby-shower", "halloween", "ninos", "niños", "papa", "papá", "mama", "mamá", "celebracion", "fiestas-patrias", "bebes"];
const characters = ["toy", "snoopy", "stitch", "pokemon", "bluey", "gabby", "marvel", "pooh", "disney", "bob-esponja", "pawpatrol", "spiderman", "lilo", "netflix"];

function label(name: string) {
  return name.replace(/^Todo\s+/i, "").replace(/Pokemon/i, "Pokémon").replace(/Futbol/i, "Fútbol").replace(/Superheroes/i, "Superhéroes").replace(/ToyStory/i, "Toy Story").replace(/Winie The Pooh/i, "Winnie the Pooh").replace(/FoodHall/i, "Food Hall").replace(/LiLo-Stitch/i, "Lilo & Stitch");
}

export default function MobileCategoryAccordions({ categories, close, navigation = defaultNavigation }: { categories: Category[]; close: () => void; navigation?: NavigationConfig }) {
  const [open, setOpen] = useState<string | null>(null);
  const ordered = [...categories].sort((a, b) => {
    const ai = navigation.categoryOrder.indexOf(a.id), bi = navigation.categoryOrder.indexOf(b.id);
    return (ai < 0 ? 9999 : ai) - (bi < 0 ? 9999 : bi) || a.name.localeCompare(b.name, "es");
  });
  const fallbackGroup = (category: Category) => celebrations.some((term) => category.slug.includes(term)) ? "celebrations" : characters.some((term) => category.slug.includes(term)) ? "characters" : "themes";
  const navLink = (id: string) => navigation.links?.find((item) => item.id === id) || defaultLinks.find((item) => item.id === id)!;
  const itemOrder = navigation.itemOrder || defaultNavigation.itemOrder!;
  const accordion = (key: string, title: string, items: Category[]) => {
    const expanded = open === key;
    return <section className={`drawer-group ${expanded ? "open" : ""}`} key={key}><button type="button" aria-expanded={expanded} aria-controls={`mobile-group-${key}`} onClick={() => setOpen(expanded ? null : key)}><span>{title}</span><i aria-hidden="true">⌄</i></button><div id={`mobile-group-${key}`} hidden={!expanded}>{items.map((category) => <Link key={category.id} href={`/categoria/${encodeURIComponent(category.slug)}`} onClick={close}>{label(category.name)}</Link>)}</div></section>;
  };
  return <div className="mobile-category-accordions">{itemOrder.map((entry) => {
    if (entry.startsWith("menu:")) {
      const menuId = entry.slice(5);
      const menu = navigation.menus.find((item) => item.id === menuId);
      if (!menu) return null;
      const items = ordered.filter((category) => Object.prototype.hasOwnProperty.call(navigation.categoryMenu, category.id) ? navigation.categoryMenu[category.id] === menu.id : fallbackGroup(category) === menu.id);
      return accordion(entry, menu.label, items);
    }
    if (!entry.startsWith("link:")) return null;
    const id = entry.slice(5);
    const link = navLink(id);
    if (!link) return null;
    if (id === "more") {
      const expanded = open === entry;
      return <section className={`drawer-group ${expanded ? "open" : ""}`} key={entry}><button type="button" aria-expanded={expanded} aria-controls="mobile-group-more" onClick={() => setOpen(expanded ? null : entry)}><span>{link.label}</span><i aria-hidden="true">⌄</i></button><div id="mobile-group-more" hidden={!expanded}><Link href="/contacto" onClick={close}>Contacto</Link><Link href="/terminos-y-condiciones" onClick={close}>Términos y Condiciones</Link><Link href="/politica-de-reembolso" onClick={close}>Política de reembolso</Link><Link href="/politica-de-privacidad" onClick={close}>Política de privacidad</Link></div></section>;
    }
    const assigned = ordered.filter((category) => navigation.categoryMenu[category.id] === entry);
    if (id !== "home" && assigned.length) return accordion(entry, link.label, assigned);
    return <Link key={entry} className={`drawer-direct ${id === "all" ? "drawer-all" : ""}`} href={link.href} onClick={close}>{link.label} <span>→</span></Link>;
  })}</div>;
}
