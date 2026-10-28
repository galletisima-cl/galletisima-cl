"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProductBenefitsFaq from "../../components/ProductBenefitsFaq";
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
  const [whatsappNumber, setWhatsappNumber] = useState("56936658541");

  useEffect(() => {
    document.title = "Cómo pedir tu cortador personalizado | Galletísima";
    const supabase = createClient();
    supabase.from("site_settings").select("value").eq("key", "whatsapp_number").maybeSingle()
      .then(({ data }) => { if (data?.value) setWhatsappNumber(data.value); });
  }, []);

  const whatsappUrl = createWhatsappUrl(whatsappNumber, "Hola! Quiero pedir un cortador personalizado. Te envío mi idea:");

  return <main className="howto-page">
    <PublicHeader />

    <nav className="howto-breadcrumb shell" aria-label="Ruta de navegación">
      <Link href="/">Inicio</Link><span aria-hidden="true">▸</span><strong>Cortador personalizado</strong>
    </nav>

    <section className="howto-detail shell">
      <div className="howto-photo">
        <img src="/hero-cookies.webp" alt="Cortadores de galletas personalizados y galletas decoradas" decoding="async" />
      </div>

      <div className="howto-content">
        <p className="eyebrow">MOLDES A TU MEDIDA</p>
        <h1>Cortador de galletas personalizado</h1>
        <strong className="howto-price">{SIZES[0].price} – {SIZES[SIZES.length - 1].price}</strong>
        <p className="howto-price-note">Precio base según el tamaño. El modelado 3D no tiene costo adicional.</p>

        <div className="howto-copy">
          <p>✨ Crea un cortador de galletas único a partir de tu imagen, logo, nombre o idea. Elige el tamaño y lo fabricamos especialmente para ti mediante impresión 3D.</p>
          <p>💌 Envíanos tu imagen de referencia por WhatsApp: puede ser de Pinterest, una foto o un boceto hecho a mano.</p>
          <p className="howto-copy-note">La imagen es necesaria para comenzar a preparar el diseño.</p>
        </div>

        <div className="howto-callout">
          <PencilIcon />
          <p><b>¿Cómo elegir el tamaño?</b> Dinos de cuántos centímetros quieres tu cortador. Si necesitas uno más grande que 14 cm, lo evaluamos a pedido.</p>
        </div>

        <p className="howto-label">Tamaños disponibles</p>
        <ul className="howto-sizes" aria-label="Tamaños y precios base">
          {SIZES.map((item) => <li key={item.size}><span>{item.size}</span><small>{item.price}</small></li>)}
        </ul>

        <a className="button primary howto-cta" href={whatsappUrl} target="_blank" rel="noreferrer">Enviar mi idea por WhatsApp <span>→</span></a>

        <div className="howto-assurances">
          <span><PencilIcon />Modelado 3D sin costo</span>
          <span><TruckIcon />Envíos a todo Chile</span>
          <span><ClockIcon />Fabricación a pedido</span>
          <span><HeartIcon />Diseños personalizados</span>
        </div>
        <p className="howto-fineprint"><b>Envío:</b> BlueExpress con tarifa fija de $3.500. <b>Pago:</b> Webpay y Mercado Pago en la web, o transferencia coordinada por WhatsApp.</p>
      </div>
    </section>

    <section className="howto-steps shell" aria-label="Pasos para pedir">
      <h2 className="howto-steps-title">Así de fácil es pedir el tuyo</h2>
      <div>
        {STEPS.map((step, index) => <article className="howto-step" key={step.title}>
          <span className="howto-number" aria-hidden="true">{index + 1}</span>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </article>)}
      </div>
      <p className="howto-catalog"><Link href="/?ver=todos#catalogo">O mira primero el catálogo completo →</Link></p>
    </section>

    <ProductBenefitsFaq />
  </main>;
}

function Icon({ children }: { children: React.ReactNode }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;
}
function PencilIcon() {
  return <Icon><path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z" /><path d="M14.5 6.5l3 3" /></Icon>;
}
function TruckIcon() {
  return <Icon><path d="M3 6.75h11.5v10H3zM14.5 10h3.25L21 13.25v3.5h-6.5z" /><path d="M7.25 19a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Zm10.5 0a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" /></Icon>;
}
function ClockIcon() {
  return <Icon><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Icon>;
}
function HeartIcon() {
  return <Icon><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z" /></Icon>;
}
