"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";

type ConnectionStatus = {
  configured: boolean; storageReady: boolean; needsReconnect: boolean;
  providers: { instagram: boolean; facebook: boolean };
  connection: { username: string; expires_at: string | null; synced_at: string | null; last_error: string | null; provider: "instagram" | "facebook" } | null;
};

export default function AdminInstagramPanel() {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const request = useCallback(async (action?: string, provider?: "instagram" | "facebook") => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Tu sesión expiró. Vuelve a ingresar.");
    const response = await fetch("/api/admin/instagram", {
      method: action ? "POST" : "GET",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      ...(action ? { body: JSON.stringify({ action, provider }) } : {}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo consultar Instagram.");
    return data;
  }, [supabase]);
  useEffect(() => {
    let active = true;
    void request().then(data => { if (active) setStatus(data); }).catch(caught => { if (active) setError(caught.message); });
    return () => { active = false; };
  }, [request]);
  async function act(action: "connect" | "sync" | "disconnect", provider?: "instagram" | "facebook") {
    if (action === "disconnect" && !window.confirm("¿Desconectar Instagram de la tienda? Se quitará la galería de publicaciones de la portada.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await request(action, provider);
      if (action === "connect") { window.location.assign(result.url); return; }
      const updated: ConnectionStatus = await request();
      setStatus(updated);
      if (action === "disconnect") setMessage("Instagram desconectado de la tienda.");
      else if (!updated.connection?.last_error) setMessage("Publicaciones actualizadas.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo completar la acción."); }
    finally { setBusy(false); }
  }
  const connection = status?.connection;
  const reconnect = status?.needsReconnect;
  return <section className="instagram-admin" aria-labelledby="instagram-admin-title">
    <h4 id="instagram-admin-title">Publicaciones de Instagram</h4>
    <p>Conecta una cuenta profesional (empresa o creador) para mostrar sus fotos y portadas de reels en la tienda.</p>
    {!status && !error && <p role="status">Consultando conexión…</p>}
    {status && (!status.configured || !status.storageReady) && <p className="instagram-admin-warning">La galería está preparada. Falta completar la configuración de Meta y de la conexión en el servidor para habilitar este botón.</p>}
    {connection && <div className="instagram-connection-summary"><strong>@{connection.username}</strong><span>{reconnect ? "Necesita volver a conectarse" : "Cuenta conectada"}</span><small>{connection.synced_at ? `Última actualización: ${new Date(connection.synced_at).toLocaleString("es-CL")}` : "Publicaciones pendientes de actualizar"}</small></div>}
    {connection?.provider === "facebook" && !reconnect && (connection.expires_at
      ? <p className="instagram-admin-warning">Conectada mediante Facebook hasta el {new Date(connection.expires_at).toLocaleDateString("es-CL")}. Vuelve a conectar antes de esa fecha para mantener la galería actualizada.</p>
      : <p className="instagram-admin-success">Conexión sin vencimiento programado. Las publicaciones se actualizan automáticamente mientras se mantengan los permisos en Meta.</p>)}
    {connection?.last_error === "unavailable" && <p className="instagram-admin-warning">No pudimos actualizar las publicaciones. Puedes reintentarlo; conservamos la última galería disponible temporalmente.</p>}
    {reconnect && <p className="instagram-admin-warning">Instagram necesita una nueva autorización. Vuelve a conectar la cuenta para recuperar la galería.</p>}
    <div className="instagram-admin-actions">
      {status?.providers.facebook && <button type="button" disabled={busy || !status.storageReady} onClick={() => void act("connect", "facebook")}>{busy ? "Procesando…" : connection ? "Reconectar con Facebook" : "Conectar con Facebook"}</button>}
      <button type="button" disabled={busy || !status?.providers.instagram || !status.storageReady} onClick={() => void act("connect", "instagram")}>{busy ? "Procesando…" : connection ? "Reconectar con Instagram" : "Conectar con Instagram"}</button>
      {connection && <><button type="button" disabled={busy || !!reconnect || !status?.configured} onClick={() => void act("sync")}>Actualizar publicaciones</button><button type="button" disabled={busy} onClick={() => void act("disconnect")}>Desconectar de la tienda</button></>}
    </div>
    <small>Autoriza en Instagram o usa Facebook si la cuenta está vinculada a una página que administras. La conexión sirve para leer el perfil y sus publicaciones.</small>
    {message && <p className="instagram-admin-success" role="status">{message}</p>}
    {error && <p className="instagram-admin-warning" role="alert">{error}</p>}
  </section>;
}
