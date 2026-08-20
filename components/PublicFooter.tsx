"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { createWhatsappUrl } from "../lib/whatsapp";

const DEFAULT_WHATSAPP = "56975265959";
const DEFAULT_FACEBOOK = "https://www.facebook.com/share/1Emwhrwy9q/?mibextid=wwXIfr";
const MAP_URL = "https://maps.google.com/maps?q=Metro+Vicente+Valdes+La+Florida%2C+La+Florida%2C+Regi%C3%B3n+Metropolitana%2C+Chile";

function formatWhatsapp(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.slice(-9);
  return local.length === 9 ? `+56 ${local[0]} ${local.slice(1, 5)} ${local.slice(5)}` : `+${digits}`;
}

export default function PublicFooter() {
  const pathname = usePathname();
  const [whatsappNumber, setWhatsappNumber] = useState(DEFAULT_WHATSAPP);
  const [facebookUrl, setFacebookUrl] = useState(DEFAULT_FACEBOOK);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    createClient().from("site_settings").select("key,value").in("key", ["whatsapp_number", "facebook_url"])
      .then(({ data }) => {
        const settings = Object.fromEntries((data || []).map((setting) => [setting.key, setting.value]));
        if (settings.whatsapp_number) setWhatsappNumber(settings.whatsapp_number);
        if (settings.facebook_url) setFacebookUrl(settings.facebook_url);
      });
  }, [pathname]);

  if (pathname.startsWith("/admin")) return null;

  return (
    <footer id="contacto">
      <div className="shell footer-inner">
        <div className="footer-brand">
          <Image src="/galletisima-logo.png" alt="Galletísima" width={220} height={86} />
          <p>Moldes únicos para convertir tus ideas<br />en galletas inolvidables.</p>
          <div className="social-links">
            <a className="instagram-link" href="https://www.instagram.com/galletisimacl" target="_blank" rel="noreferrer" aria-label="Síguenos en Instagram como galletisimacl"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4.2" /><circle className="instagram-dot" cx="17.4" cy="6.7" r="1" /></svg><span>@galletisimacl</span></a>
            <a className="facebook-link" href={facebookUrl} target="_blank" rel="noreferrer" aria-label="Síguenos en Facebook"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 21v-8h2.8l.4-3h-3.2V8.1c0-.9.3-1.5 1.6-1.5H18V3.9c-.7-.1-1.5-.2-2.3-.2-2.3 0-3.9 1.4-3.9 4V10H9v3h2.8v8h2.7Z" /></svg><span>Facebook</span></a>
          </div>
        </div>
        <nav className="footer-links" aria-label="Información legal"><h2>Información</h2><a href="/contacto">Contacto</a><a href="/terminos-y-condiciones">Términos y Condiciones</a><a href="/politica-de-reembolso">Política de reembolso</a><a href="/politica-de-privacidad">Política de privacidad</a></nav>
        <div className="footer-contact"><h2>Encuéntranos</h2><a href={createWhatsappUrl(whatsappNumber)} target="_blank" rel="noreferrer"><span>WhatsApp</span><strong>{formatWhatsapp(whatsappNumber)}</strong></a><a href={MAP_URL} target="_blank" rel="noreferrer"><span>Retiro en La Florida</span><strong>Metro Vicente Valdés</strong></a></div>
      </div>
      <div className="shell footer-legal">
        <p className="footer-copyright">© 2026 Galletísima. Todos los derechos reservados.</p>
        <a href="/contacto">Hecho con cariño en Chile ♡</a>
      </div>
    </footer>
  );
}
