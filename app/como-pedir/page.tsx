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
  { title: "Lo fabricamos y te lo enviamos", text: "Trabajamos a pedido: la fabricación toma entre 3 y 5 días hábiles, y el envío por BlueExpress suma 1 a 2 días más." },
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

  return <main className="howto-page">
    <PublicHeader />

    <section className="howto-hero shell">
      <p className="eyebrow">MOLDES A TU MEDIDA</p>
      <h1>Cómo pedir tu cortador personalizado</h1>
      <p className="howto-intro">Si tu idea no está en el catálogo, la diseñamos contigo. El modelado 3D no tiene costo adicional.</p>
      <a className="button primary" href={whatsappUrl} target="_blank" rel="noreferrer">Enviar mi idea por WhatsApp <span>→</span></a>
    </section>

    <section className="howto-steps shell" aria-label="Pasos para pedir">
      {STEPS.map((step, index) => <article className="howto-step" key={step.title}>
        <span className="howto-number" aria-hidden="true">{index + 1}</span>
        <h2>{step.title}</h2>
        <p>{step.text}</p>
      </article>)}
    </section>

    <section className="howto-info shell" aria-label="Tamaños, envío y pagos">
      <div className="howto-sizes">
        <h2>Tamaños y precios base</h2>
        <ul>{SIZES.map((item) => <li key={item.size}><span>{item.size}</span><strong>{item.price}</strong></li>)}</ul>
      </div>
      <div className="howto-notes">
        <p><b>Envío:</b> BlueExpress a todo Chile con tarifa fija de $3.500.</p>
        <p><b>Pago:</b> Webpay y Mercado Pago en la web, o transferencia coordinada por WhatsApp.</p>
      </div>
      <p className="howto-catalog"><Link href="/?ver=todos#catalogo">O mira primero el catálogo completo →</Link></p>
    </section>
  </main>;
}
