"use client";

import { useEffect, useState } from "react";
import PublicHeader from "../../components/PublicHeader";
import { createClient } from "../../lib/supabase/client";

export default function ContactPage() {
  const [whatsappNumber, setWhatsappNumber] = useState("56975265959");

  useEffect(() => {
    const supabase = createClient();
    supabase.from("site_settings").select("value").eq("key", "whatsapp_number").single()
      .then(({ data }) => { if (data?.value) setWhatsappNumber(data.value); });
  }, []);

  const readableNumber = `+56 9 ${whatsappNumber.slice(-8, -4)} ${whatsappNumber.slice(-4)}`;

  return <main className="contact-page">
    <PublicHeader />

    <section className="contact-hero">
      <div className="shell">
        <p className="eyebrow">ESTAMOS PARA AYUDARTE</p>
        <h1>Contáctanos</h1>
        <div className="title-line" />
        <p className="contact-intro">Aquí puedes encontrar todos los canales disponibles mediante los cuales nos puedes contactar.</p>
      </div>
    </section>

    <section className="contact-grid shell">
      <article className="contact-card">
        <span className="contact-icon whatsapp-color"><svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16.04 3A12.9 12.9 0 0 0 5 22.57L3.28 29l6.58-1.72A12.98 12.98 0 1 0 16.04 3Zm0 23.76a10.7 10.7 0 0 1-5.45-1.49l-.39-.23-3.9 1.02 1.04-3.8-.25-.4a10.72 10.72 0 1 1 8.95 4.9Zm5.88-8.03c-.32-.16-1.9-.94-2.2-1.05-.29-.11-.5-.16-.71.16-.22.32-.83 1.05-1.02 1.27-.18.21-.37.24-.69.08-1.89-.94-3.12-1.69-4.37-3.82-.33-.57.33-.53.94-1.76.11-.21.05-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55h-.61c-.22 0-.56.08-.85.4-.29.32-1.12 1.1-1.12 2.66s1.15 3.08 1.3 3.29c.16.21 2.25 3.43 5.45 4.81.76.33 1.36.53 1.82.67.77.24 1.46.21 2.01.13.62-.09 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.14-.29-.22-.61-.38Z"/></svg></span>
        <h2>WhatsApp</h2>
        <p>Escríbenos para resolver dudas o solicitar un molde personalizado.</p>
        <a className="contact-action whatsapp-action" href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer">{readableNumber} <span>→</span></a>
      </article>

      <article className="contact-card">
        <span className="contact-icon location-color">⌖</span>
        <h2>Dirección</h2>
        <p className="address-links">{["Galletísima","Metro Vicente Valdés","La Florida - La Florida","Región Metropolitana - Chile"].map(line=><a key={line} href="https://maps.google.com/maps?q=Metro+Vicente+Valdes+La+Florida%2C+La+Florida%2C+Regi%C3%B3n+Metropolitana%2C+Chile" target="_blank" rel="noreferrer">{line}</a>)}</p>
        <a className="contact-action" href="https://www.google.com/maps/search/?api=1&query=Metro+Vicente+Valdes+La+Florida+Chile" target="_blank" rel="noreferrer">Ver ubicación <span>→</span></a>
      </article>

      <article className="contact-card">
        <span className="contact-icon instagram-color"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle className="instagram-dot" cx="17.4" cy="6.7" r="1"/></svg></span>
        <h2>Síguenos</h2>
        <p>Conoce nuevos moldes, ideas y creaciones de nuestra comunidad.</p>
        <a className="contact-action" href="https://www.instagram.com/galletisimacl" target="_blank" rel="noreferrer">@galletisimacl <span>→</span></a>
      </article>
    </section>
  </main>;
}
