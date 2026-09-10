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
  const [whatsappMessageOpen, setWhatsappMessageOpen] = useState(true);

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

  return <>
    <div className="whatsapp-widget">
      {whatsappMessageOpen && <div className="whatsapp-message" role="status"><span>Si tienes dudas, escríbenos!!!</span><button type="button" aria-label="Cerrar mensaje de WhatsApp" onClick={() => setWhatsappMessageOpen(false)}>×</button></div>}
      <a className="whatsapp" href={createWhatsappUrl(whatsappNumber)} target="_blank" rel="noreferrer" aria-label="Escríbenos por WhatsApp">
        <svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16.04 3A12.9 12.9 0 0 0 5 22.57L3.28 29l6.58-1.72A12.98 12.98 0 1 0 16.04 3Zm0 23.76a10.7 10.7 0 0 1-5.45-1.49l-.39-.23-3.9 1.02 1.04-3.8-.25-.4a10.72 10.72 0 1 1 8.95 4.9Zm5.88-8.03c-.32-.16-1.9-.94-2.2-1.05-.29-.11-.5-.16-.71.16-.22.32-.83 1.05-1.02 1.27-.18.21-.37.24-.69.08-1.89-.94-3.12-1.69-4.37-3.82-.33-.57.33-.53.94-1.76.11-.21.05-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55h-.61c-.22 0-.56.08-.85.4-.29.32-1.12 1.1-1.12 2.66s1.15 3.08 1.3 3.29c.16.21 2.25 3.43 5.45 4.81.76.33 1.36.53 1.82.67.77.24 1.46.21 2.01.13.62-.09 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.14-.29-.22-.61-.38Z"/></svg>
      </a>
    </div>
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
  </>;
}
