"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import PublicHeader from "../../../components/PublicHeader";
import { addCartItem } from "../../../lib/cart";
import { createClient } from "../../../lib/supabase/client";

type Product = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  price: number;
  stock: number;
  size: string;
  image_url: string;
};

const currency = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const productFaqs = [
  { question: "¿Puedo pagar cuando llega?", answer: "Sí, el pago al recibir está disponible exclusivamente para entregas en Santiago. Para otras comunas debes utilizar los medios de pago disponibles al confirmar tu compra." },
  { question: "¿Cuánto tardan en preparar mi pedido?", answer: "El plazo de preparación depende de la cantidad y de los modelos elegidos. Te informaremos la fecha estimada al confirmar el pedido." },
  { question: "¿Hacen envíos a regiones?", answer: "Sí, realizamos envíos a todo Chile. El costo y el plazo de transporte dependen de la comuna de destino." },
  { question: "¿De qué material están hechos los cortadores?", answer: "Nuestros cortadores se fabrican en plástico de uso alimentario, liviano y diseñado para lograr cortes definidos." },
  { question: "¿Puedo lavar mis cortadores con agua caliente?", answer: "Recomendamos lavarlos a mano con agua fría o tibia y jabón suave. No uses agua caliente ni lavavajillas, porque el calor puede deformarlos." },
];

function parseSizes(value: string) {
  return value.split(/[,;\n]+/).map((size) => size.trim()).filter(Boolean);
}

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("products")
      .select("id,name,slug,sku,description,price,stock,size,image_url")
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true);
        else {
          setProduct(data);
          setSelectedSize(parseSizes(data.size)[0] || "");
        }
        setLoading(false);
      });
  }, [slug]);

  const addToCart = () => {
    if (!product) return;
    if (parseSizes(product.size).length && !selectedSize) {
      setNotice("Selecciona una medida antes de agregar al carrito.");
      return;
    }
    addCartItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      size: selectedSize,
      price: product.price,
      imageUrl: product.image_url,
      quantity,
    });
    setNotice(`${quantity} × ${product.name}${selectedSize ? ` · ${selectedSize}` : ""} agregado al carrito`);
  };

  if (loading) {
    return <main className="product-page"><PublicHeader /><section className="product-state"><span className="catalog-loader"><i /> Cargando producto…</span></section></main>;
  }

  if (notFound || !product) {
    return <main className="product-page"><PublicHeader /><section className="product-state"><Image src="/galletisima-logo.png" alt="Galletísima" width={240} height={94} /><h1>Producto no disponible</h1><p>Este producto no existe o ya no está publicado.</p><Link className="button primary" href="/?ver=todos#catalogo">Volver al catálogo</Link></section></main>;
  }

  const sizes = parseSizes(product.size);

  return (
    <main className="product-page">
      <PublicHeader />
      <section className="product-detail shell">
        <div className={`product-detail-image ${product.image_url ? "has-image" : ""}`} style={{ backgroundImage: product.image_url ? `url(${product.image_url})` : undefined }} role="img" aria-label={`Imagen de ${product.name}`} />
        <div className="product-detail-content">
          <p className="product-sku">SKU {product.sku}</p>
          <h1>{product.name}</h1>
          <strong className="product-detail-price">{product.price ? currency.format(product.price) : "Consultar"}</strong>
          <p className="product-description">{product.description || "Molde Galletísima creado para dar vida a tus ideas."}</p>
          <div className="product-order-panel">
            {sizes.length ? <fieldset className="size-selector"><legend>Selecciona una medida</legend><div>{sizes.map((size) => <button type="button" key={size} className={selectedSize === size ? "selected" : ""} aria-pressed={selectedSize === size} onClick={() => setSelectedSize(size)}>{size}</button>)}</div></fieldset> : <p className="size-pending">Medida por confirmar</p>}
            {product.stock > 0 && <div className="stock-line"><span className="available" />{product.stock} unidades disponibles</div>}
            <div className="purchase-row">
              <div className="quantity-picker" aria-label="Cantidad"><button type="button" aria-label="Disminuir cantidad" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button><strong>{quantity}</strong><button type="button" aria-label="Aumentar cantidad" onClick={() => setQuantity((value) => value + 1)}>+</button></div>
              <button className="product-add" type="button" onClick={addToCart}>Agregar al carrito</button>
            </div>
            <div className="product-assurances"><span>♡ Diseñado con cariño</span><span>▣ Envíos a todo Chile</span></div>
          </div>
        </div>
      </section>
      <section className="product-benefits shell" aria-labelledby="product-benefits-title">
        <div className="pay-on-delivery"><strong>✨ PAGA CUANDO LLEGUE ✨</strong><em>exclusivo en Santiago.</em><span>¡Pide hoy y paga al recibir en tu puerta!</span></div>
        <div className="benefits-intro"><h2 id="product-benefits-title">Diseñados para durar</h2><p>Creamos herramientas mágicas utilizando tecnología de impresión 3D de alta precisión y materiales amigables con el planeta.</p></div>
        <div className="benefit-cards">
          <article><span aria-hidden="true">🌱</span><strong>Material Bio-Plástico</strong><h3>PLA Premium</h3><p>Material liviano de origen vegetal, ideal para crear formas precisas.</p></article>
          <article><span aria-hidden="true">✦</span><strong>Alta precisión</strong><h3>Impresión 3D</h3><p>Bordes definidos y detalles nítidos para resultados consistentes.</p></article>
          <article><span aria-hidden="true">♡</span><strong>Hecho con cariño</strong><h3>Producción local</h3><p>Cada molde se prepara especialmente para tu pedido.</p></article>
        </div>
      </section>
      <section className="product-faq shell" aria-labelledby="product-faq-title">
        <p>¿Tienes dudas? ¡Te ayudamos!</p>
        <h2 id="product-faq-title">Preguntas frecuentes</h2>
        <div>
          {productFaqs.map((faq) => <details key={faq.question}><summary>{faq.question}<span aria-hidden="true">⌄</span></summary><p>{faq.answer}</p></details>)}
        </div>
      </section>
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
