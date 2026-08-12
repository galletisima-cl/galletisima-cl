"use client";

import Image from "next/image";
import { useState } from "react";

const categories = [
  ["🎂", "Cumpleaños"], ["🧸", "Infantil"], ["🐾", "Animales"],
  ["✿", "Flores"], ["♡", "Fechas especiales"], ["🎄", "Navidad"],
  ["♟", "Profesiones"], ["•••", "Más"],
];

const products = [
  { name: "Oso Tierno", size: "8 cm", price: "$3.990", pos: "58% 84%", tag: "favorito" },
  { name: "Flor Vintage", size: "7 cm", price: "$3.490", pos: "72% 10%" },
  { name: "Arcoíris", size: "9 cm", price: "$3.490", pos: "45% 48%", tag: "nuevo" },
  { name: "Dino Rex", size: "10 cm", price: "$3.990", pos: "78% 45%" },
  { name: "Corazón Clásico", size: "6 cm", price: "$2.990", pos: "90% 23%" },
  { name: "Flor de Primavera", size: "7 cm", price: "$3.490", pos: "82% 82%" },
];

export default function Home() {
  const [cart, setCart] = useState(2);
  const [liked, setLiked] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const add = (name: string) => {
    setCart((value) => value + 1);
    setNotice(`${name} fue agregado a tu carrito`);
    window.setTimeout(() => setNotice(""), 2200);
  };

  return (
    <main>
      <div className="benefit-bar">
        <span>▣ <b>Envíos a todo Chile</b></span>
        <span>♡ <b>Moldes personalizados</b></span>
        <span>♙ <b>Compra 100% segura</b></span>
      </div>

      <header className="header shell">
        <nav className="desktop-nav" aria-label="Navegación principal">
          <a href="#moldes">Moldes</a>
          <a href="#categorias">Categorías</a>
          <a href="#contacto">Contacto</a>
        </nav>
        <button className="icon-button menu-button" aria-label="Abrir menú" onClick={() => setMenuOpen(!menuOpen)}>
          <i /><i /><i />
        </button>
        <a className="brand" href="#inicio" aria-label="Galletísima, inicio">
          <Image src="/galletisima-logo.png" alt="Galletísima" width={360} height={140} priority />
        </a>
        <div className="header-actions">
          <button className="icon-button search" aria-label="Buscar">⌕</button>
          <button className="icon-button cart" aria-label={`Carrito con ${cart} productos`}>
            🛒<em>{cart}</em>
          </button>
        </div>
        {menuOpen && <nav className="menu" aria-label="Navegación móvil"><a href="#moldes">Moldes</a><a href="#categorias">Categorías</a><a href="#contacto">Contacto</a></nav>}
      </header>

      <section id="inicio" className="hero">
        <div className="hero-image" role="img" aria-label="Moldes verdes y galletas decoradas sobre fondo rosado" />
        <div className="hero-content shell">
          <p className="eyebrow">MOLDES QUE CONVIERTEN</p>
          <h1>tus ideas en<br/><strong>galletas<br/>increíbles</strong></h1>
          <p className="hero-copy">Diseños únicos para cada ocasión<br/>o crea tu propio molde personalizado.</p>
          <div className="hero-buttons">
            <a className="button primary" href="#moldes">VER TODOS LOS MOLDES <span>→</span></a>
            <a className="button secondary" href="#contacto">MOLDE PERSONALIZADO <span>→</span></a>
          </div>
        </div>
        <div className="hero-note"><span>♡</span> Hechos para<br/>crear momentos<br/><b>únicos</b></div>
      </section>

      <section id="categorias" className="section shell">
        <h2>Encuentra el molde perfecto</h2>
        <div className="title-line" />
        <div className="categories">
          {categories.map(([icon, label]) => <button key={label}><span>{icon}</span><small>{label}</small></button>)}
        </div>
      </section>

      <section id="moldes" className="section products-section shell">
        <h2>Los más vendidos</h2>
        <div className="title-line" />
        <div className="product-grid">
          {products.map((product) => {
            const isLiked = liked.includes(product.name);
            return <article className="product-card" key={product.name}>
              <div className="product-photo" style={{ backgroundPosition: product.pos }}>
                {product.tag && <span className="tag">{product.tag}</span>}
                <button className={`heart ${isLiked ? "active" : ""}`} aria-label={`Guardar ${product.name}`} onClick={() => setLiked(isLiked ? liked.filter((name) => name !== product.name) : [...liked, product.name])}>♡</button>
              </div>
              <div className="product-info">
                <div><h3>{product.name}</h3><p>{product.size}</p><strong>{product.price}</strong></div>
                <button className="add" aria-label={`Agregar ${product.name} al carrito`} onClick={() => add(product.name)}>🛒</button>
              </div>
            </article>;
          })}
        </div>
        <a className="view-all" href="#moldes">VER TODOS LOS MOLDES →</a>
      </section>

      <section className="values">
        <div className="shell value-grid">
          <div><span>❧</span><p>Diseños únicos<br/><b>y originales</b></p></div>
          <div><span>♢</span><p>Materiales de alta<br/><b>calidad y duraderos</b></p></div>
          <div><span>♧</span><p>Fáciles de usar y<br/><b>fáciles de limpiar</b></p></div>
          <div><span>♡</span><p>Hechos para inspirar<br/><b>tus creaciones</b></p></div>
        </div>
      </section>

      <footer id="contacto">
        <div className="shell footer-inner">
          <div className="footer-brand"><Image src="/galletisima-logo.png" alt="Galletísima" width={220} height={86} /><p>Convierte tus ideas en algo delicioso.</p></div>
          <form onSubmit={(event) => { event.preventDefault(); setNotice("¡Gracias! Pronto recibirás nuestras novedades"); }}>
            <label htmlFor="email">¡No te pierdas novedades<br/>y descuentos exclusivos!</label>
            <div><input id="email" type="email" placeholder="Tu email" required/><button>✉ Suscribirme</button></div>
          </form>
        </div>
      </footer>
      <a className="whatsapp" href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "56900000000"}`} target="_blank" rel="noreferrer" aria-label="Escríbenos por WhatsApp">
        <svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16.04 3A12.9 12.9 0 0 0 5 22.57L3.28 29l6.58-1.72A12.98 12.98 0 1 0 16.04 3Zm0 23.76a10.7 10.7 0 0 1-5.45-1.49l-.39-.23-3.9 1.02 1.04-3.8-.25-.4a10.72 10.72 0 1 1 8.95 4.9Zm5.88-8.03c-.32-.16-1.9-.94-2.2-1.05-.29-.11-.5-.16-.71.16-.22.32-.83 1.05-1.02 1.27-.18.21-.37.24-.69.08-1.89-.94-3.12-1.69-4.37-3.82-.33-.57.33-.53.94-1.76.11-.21.05-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55h-.61c-.22 0-.56.08-.85.4-.29.32-1.12 1.1-1.12 2.66s1.15 3.08 1.3 3.29c.16.21 2.25 3.43 5.45 4.81.76.33 1.36.53 1.82.67.77.24 1.46.21 2.01.13.62-.09 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.14-.29-.22-.61-.38Z"/></svg>
      </a>
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
