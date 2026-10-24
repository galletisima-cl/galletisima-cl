"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PublicHeader from "../../components/PublicHeader";
import { createClient } from "../../lib/supabase/client";
import { createWhatsappUrl } from "../../lib/whatsapp";

const SIZES = [
  { size: "6 cm", price: "$1.600" },
  { size: "8 cm", price: "$2.000" },
  { size: "10 cm", price: "$2.500" },
  { size: "12 cm", price: "$2.900" },
  { size: "14 cm", price: "$3.400" },
];

const STEPS = [
  { title: "Cuéntanos tu idea", text: "Envíanos por WhatsApp una imagen de referencia: puede ser de Pinterest, una foto o un boceto hecho a mano." },
  { title: "Elige el tamaño", text: "Dinos de cuántos centímetros quieres tu cortador. Si necesitas uno más grande que 14 cm, lo evaluamos a pedido." },
  { title: "Lo modelamos en 3D, sin costo", text: "Diseñamos tu cortador a medida y no te cobramos nada extra por el modelado." },
  { title: "Lo fabricamos y te lo enviamos", text: "Trabajamos a pedido: la fabricación toma entre 3 y 5 días hábiles, y el envío por BlueExpress suma 1 a 2 días." },
];

export default function HowToOrderPage() {
  const [whatsappNumber, setWhatsappNumber] = useState("56975265959");

  useEffect(() => {
    document.title = "Cómo pedir tu cortador personalizado | Galletísima";
    const supabase = createClient();
    supabase.from("site_settings").select("value").eq("key", "whatsapp_number").maybeSingle()
      .then(({ data }) => { if (data?.value) setWhatsappNumber(data.value); });
  }, []);

  const whatsappUrl = createWhatsappUrl(whatsappNumber, "Hola! Quiero pedir un cortador personalizado. Te envío mi idea:");

  return <main className="contact-page">
    <PublicHeader />

    <section className="contact-hero">
      <div className="shell">
        <p className="eyebrow">MOLDES A TU MEDIDA</p>
        <h1>Cómo pedir tu cortador personalizado</h1>
        <div className="title-line" />
        <p className="contact-intro">Si tu idea no está en el catálogo, la diseñamos contigo. El modelado 3D no tiene costo adicional.</p>
      </div>
    </section>

    <section className="contact-grid shell" aria-label="Pasos para pedir">
      {STEPS.map((step, index) => <article className="contact-card" key={step.title}>
        <span className="contact-icon" aria-hidden="true">{index + 1}</span>
        <h2>{step.title}</h2>
        <p>{step.text}</p>
      </article>)}
    </section>

    <section className="section shell" aria-labelledby="sizes-title">
      <p className="eyebrow catalog-eyebrow">PRECIOS BASE</p>
      <h2 id="sizes-title">Tamaños de cortador</h2>
      <div className="title-line" />
      <div className="contact-grid">
        {SIZES.map((item) => <article className="contact-card" key={item.size}>
          <h2>{item.size}</h2>
          <p><strong>{item.price}</strong></p>
        </article>)}
      </div>
    </section>

    <section className="section shell" aria-labelledby="shipping-title">
      <p className="eyebrow catalog-eyebrow">ENVÍOS Y PAGOS</p>
      <h2 id="shipping-title">Antes de pedir</h2>
      <div className="title-line" />
      <div className="contact-grid">
        <article className="contact-card">
          <h2>Envío</h2>
          <p>Despachamos por BlueExpress a todo Chile, con tarifa fija de $3.500.</p>
        </article>
        <article className="contact-card">
          <h2>Formas de pago</h2>
          <p>Webpay y Mercado Pago en la web, o transferencia bancaria coordinada por WhatsApp.</p>
        </article>
      </div>
      <p style={{ textAlign: "center", marginTop: 32 }}>
        <a className="button primary" href={whatsappUrl} target="_blank" rel="noreferrer">Enviar mi idea por WhatsApp <span>→</span></a>
      </p>
      <p style={{ textAlign: "center", marginTop: 16 }}><Link href="/?ver=todos#catalogo">O mira primero el catálogo completo →</Link></p>
    </section>
  </main>;
}
