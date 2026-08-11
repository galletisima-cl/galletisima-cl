"use client";

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
        <button className="icon-button menu-button" aria-label="Abrir menú" onClick={() => setMenuOpen(!menuOpen)}>
          <i /><i /><i />
        </button>
        <a className="brand" href="#inicio" aria-label="Galletísima, inicio">
          <span className="brand-flower">✿</span><span>Galletísima</span>
        </a>
        <div className="header-actions">
          <button className="icon-button search" aria-label="Buscar">⌕</button>
          <button className="icon-button cart" aria-label={`Carrito con ${cart} productos`}>
            🛒<em>{cart}</em>
          </button>
        </div>
        {menuOpen && <nav className="menu"><a href="#moldes">Moldes</a><a href="#categorias">Categorías</a><a href="#contacto">Contacto</a></nav>}
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
          <div><span className="mini-brand">Galletísima</span><p>Convierte tus ideas en algo delicioso.</p></div>
          <form onSubmit={(event) => { event.preventDefault(); setNotice("¡Gracias! Pronto recibirás nuestras novedades"); }}>
            <label htmlFor="email">¡No te pierdas novedades<br/>y descuentos exclusivos!</label>
            <div><input id="email" type="email" placeholder="Tu email" required/><button>✉ Suscribirme</button></div>
          </form>
        </div>
      </footer>
      <a className="whatsapp" href="https://wa.me/56900000000" aria-label="Escríbenos por WhatsApp">☎</a>
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
