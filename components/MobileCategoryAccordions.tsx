"use client";

import Link from "next/link";
import { useState } from "react";

type Category = { id: string; name: string; slug: string };
const celebrations = ["navidad", "baby-shower", "halloween", "ninos", "niños", "papa", "papá", "mama", "mamá", "celebracion", "fiestas-patrias", "bebes"];
const characters = ["toy", "snoopy", "stitch", "pokemon", "bluey", "gabby", "marvel", "pooh", "disney", "bob-esponja", "pawpatrol", "spiderman", "lilo", "netflix"];

function label(name: string) {
  return name.replace(/^Todo\s+/i, "").replace(/Pokemon/i, "Pokémon").replace(/Futbol/i, "Fútbol").replace(/Superheroes/i, "Superhéroes").replace(/ToyStory/i, "Toy Story").replace(/Winie The Pooh/i, "Winnie the Pooh").replace(/FoodHall/i, "Food Hall").replace(/LiLo-Stitch/i, "Lilo & Stitch");
}

export default function MobileCategoryAccordions({ categories, close }: { categories: Category[]; close: () => void }) {
  const [open, setOpen] = useState<string | null>("celebrations");
  const groups = [
    { key: "celebrations", title: "Celebraciones", items: categories.filter((category) => celebrations.some((term) => category.slug.includes(term))) },
    { key: "characters", title: "Personajes", items: categories.filter((category) => characters.some((term) => category.slug.includes(term))) },
    { key: "themes", title: "Temáticas", items: categories.filter((category) => !celebrations.some((term) => category.slug.includes(term)) && !characters.some((term) => category.slug.includes(term))) },
  ];
  return <div className="mobile-category-accordions">{groups.map((group) => {
    const expanded = open === group.key;
    return <section className={`drawer-group ${expanded ? "open" : ""}`} key={group.key}><button type="button" aria-expanded={expanded} aria-controls={`mobile-group-${group.key}`} onClick={() => setOpen(expanded ? null : group.key)}><span>{group.title}</span><i aria-hidden="true">⌄</i></button><div id={`mobile-group-${group.key}`} hidden={!expanded}>{group.items.map((category) => <Link key={category.id} href={`/?categoria=${encodeURIComponent(category.slug)}#catalogo`} onClick={close}>{label(category.name)}</Link>)}</div></section>;
  })}<Link className="drawer-direct" href="/?buscar=altares#catalogo" onClick={close}>Altares <span>→</span></Link><Link className="drawer-direct" href="/?buscar=herramientas#catalogo" onClick={close}>Herramientas <span>→</span></Link><Link className="drawer-direct drawer-all" href="/?ver=todos#catalogo" onClick={close}>Ver todo <span>→</span></Link></div>;
}
