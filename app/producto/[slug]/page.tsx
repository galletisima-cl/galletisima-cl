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
  product_images: { image_url: string; sort_order: number }[];
};

const currency = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const productFaqs = [
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
  const [sizePrices, setSizePrices] = useState<Record<string, number>>({});
  const [selectedImageUrl, setSelectedImageUrl] = useState("");

  useEffect(() => {
    const supabase = createClient();
    const loadProduct = async () => {
      let result = await supabase.from("products").select("id,name,slug,sku,description,price,stock,size,image_url,product_images(image_url,sort_order)").eq("slug", slug).eq("active", true).maybeSingle();
      if (result.error) {
        const fallback = await supabase.from("products").select("id,name,slug,sku,description,price,stock,size,image_url").eq("slug", slug).eq("active", true).maybeSingle();
        result = { data: fallback.data ? { ...fallback.data, product_images: [] } : null, error: fallback.error } as typeof result;
      }
      const { data, error } = result;
        if (error || !data) setNotFound(true);
        else {
          setProduct(data);
          const firstImage = [...(data.product_images || [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.image_url || data.image_url;
          setSelectedImageUrl(firstImage || "");
          setSelectedSize(parseSizes(data.size)[0] || "");
          supabase.from("site_settings").select("value").eq("key", "product_size_prices").maybeSingle().then(({ data: setting }) => {
            try { setSizePrices(JSON.parse(setting?.value || "{}")[data.id] || {}); } catch { setSizePrices({}); }
          });
        }
        setLoading(false);
    };
    void loadProduct();
  }, [slug]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

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
      price: sizePrices[selectedSize] ?? product.price,
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
  const selectedPrice = sizePrices[selectedSize] ?? product.price;
  const gallery = (product.product_images || []).length
    ? [...product.product_images].sort((a, b) => a.sort_order - b.sort_order).map((image) => image.image_url)
    : product.image_url ? [product.image_url] : [];

  return (
    <main className="product-page">
      <PublicHeader />
      <section className="product-detail shell">
        <div className="product-gallery">
          <div className={`product-detail-image ${selectedImageUrl ? "has-image" : ""}`} style={{ backgroundImage: selectedImageUrl ? `url(${selectedImageUrl})` : undefined }} role="img" aria-label={`Imagen de ${product.name}`} />
          {gallery.length > 1 && <div className="product-gallery-thumbnails" aria-label="Galería del producto">{gallery.map((url, index) => <button type="button" key={url} className={selectedImageUrl === url ? "selected" : ""} onClick={() => setSelectedImageUrl(url)} aria-label={`Ver foto ${index + 1}`}><img src={url} alt="" /></button>)}</div>}
        </div>
        <div className="product-detail-content">
          <p className="product-sku">SKU {product.sku}</p>
          <h1>{product.name}</h1>
          <strong className="product-detail-price" aria-live="polite">{selectedPrice ? currency.format(selectedPrice) : "Consultar"}</strong>
          <p className="product-description">{product.description || "Molde Galletísima creado para dar vida a tus ideas."}</p>
          <div className="product-order-panel">
            {sizes.length ? <fieldset className="size-selector"><legend>Selecciona una medida</legend><div>{sizes.map((size) => <button type="button" key={size} className={selectedSize === size ? "selected" : ""} aria-pressed={selectedSize === size} onClick={() => setSelectedSize(size)}><span>{size}</span>{sizePrices[size] ? <small>{currency.format(sizePrices[size])}</small> : null}</button>)}</div></fieldset> : <p className="size-pending">Medida por confirmar</p>}
            <div className="purchase-row">
              <div className="quantity-picker" aria-label="Cantidad"><button type="button" aria-label="Disminuir cantidad" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button><strong>{quantity}</strong><button type="button" aria-label="Aumentar cantidad" onClick={() => setQuantity((value) => value + 1)}>+</button></div>
              <button className="product-add" type="button" onClick={addToCart}>Agregar al carrito</button>
            </div>
            <div className="product-assurances"><span>♡ Diseñado con cariño</span><span>▣ Envíos a todo Chile</span></div>
          </div>
        </div>
      </section>
      <section className="product-benefits shell" aria-labelledby="product-benefits-title">
        <div className="benefits-intro"><h2 id="product-benefits-title">Diseñados para durar</h2><p>Creamos herramientas mágicas utilizando tecnología de impresión 3D de alta precisión y materiales amigables con el planeta.</p></div>
        <div className="benefit-cards">
          <article><span aria-hidden="true">🌱</span><strong>Material Bio-Plástico</strong><h3>PLA Premium</h3><p>Material liviano de origen vegetal, ideal para crear formas precisas.</p></article>
          <article><span aria-hidden="true">✦</span><strong>Alta precisión</strong><h3>Impresión 3D</h3><p>Bordes definidos y detalles nítidos para resultados consistentes.</p></article>
          <article><span aria-hidden="true">♡</span><strong>Hecho con cariño</strong><h3>Producción local</h3><p>Cada molde se prepara especialmente para tu pedido.</p></article>
        </div>
      </section>
      <section className="product-faq shell" aria-labelledby="product-faq-title">
        <h2 id="product-faq-title" className="faq-main-title">¿Tienes dudas? ¡Te ayudamos!</h2>
        <div>
          {productFaqs.map((faq) => <details key={faq.question}><summary>{faq.question}<span aria-hidden="true">⌄</span></summary><p>{faq.answer}</p></details>)}
        </div>
      </section>
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
