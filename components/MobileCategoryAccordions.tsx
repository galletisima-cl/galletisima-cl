"use client";

import Link from "next/link";
import { useState } from "react";

type Category = { id: string; name: string; slug: string };
type NavigationLink = { id: string; label: string; href: string };
type NavigationConfig = { menus: { id: string; label: string }[]; links?: NavigationLink[]; categoryMenu: Record<string, string>; categoryOrder: string[] };
const defaultLinks: NavigationLink[] = [{ id: "altars", label: "Altares", href: "/?buscar=altares#catalogo" }, { id: "tools", label: "Herramientas", href: "/?buscar=herramientas#catalogo" }, { id: "all", label: "Ver todo", href: "/?ver=todos#catalogo" }];
const defaultNavigation: NavigationConfig = { menus: [{ id: "celebrations", label: "Celebraciones" }, { id: "characters", label: "Personajes" }, { id: "themes", label: "Temáticas" }], links: defaultLinks, categoryMenu: {}, categoryOrder: [] };
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
  const groups = navigation.menus.map((menu) => ({
    key: menu.id,
    title: menu.label,
    items: ordered.filter((category) => Object.prototype.hasOwnProperty.call(navigation.categoryMenu, category.id) ? navigation.categoryMenu[category.id] === menu.id : fallbackGroup(category) === menu.id),
  })).concat((navigation.links || []).filter((link) => link.id !== "home").map((link) => ({ key: `link:${link.id}`, title: link.label, items: ordered.filter((category) => navigation.categoryMenu[category.id] === `link:${link.id}`) }))).filter((group) => group.items.length > 0);
  const navLink = (id: string) => navigation.links?.find((item) => item.id === id) || defaultLinks.find((item) => item.id === id)!;
  const assignedLinkIds = new Set(groups.filter((group) => group.key.startsWith("link:")).map((group) => group.key.slice(5)));
  return <div className="mobile-category-accordions">{groups.map((group) => {
    const expanded = open === group.key;
    return <section className={`drawer-group ${expanded ? "open" : ""}`} key={group.key}><button type="button" aria-expanded={expanded} aria-controls={`mobile-group-${group.key}`} onClick={() => setOpen(expanded ? null : group.key)}><span>{group.title}</span><i aria-hidden="true">⌄</i></button><div id={`mobile-group-${group.key}`} hidden={!expanded}>{group.items.map((category) => <Link key={category.id} href={`/?categoria=${encodeURIComponent(category.slug)}#catalogo`} onClick={close}>{label(category.name)}</Link>)}</div></section>;
  })}{["altars", "tools", "all"].filter((id) => !assignedLinkIds.has(id)).map((id) => <Link key={id} className={`drawer-direct ${id === "all" ? "drawer-all" : ""}`} href={navLink(id).href} onClick={close}>{navLink(id).label} <span>→</span></Link>)}</div>;
}
