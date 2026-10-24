import { emailSubject, emailText, type EmailTemplates } from "./email-templates";
import { orderStatusLabel, safeTrackingUrl, type StatusNotification } from "./order-status";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const paragraph = (value: string) => escapeHtml(value).replace(/\r?\n/g, "<br>");

/** Asunto, texto y HTML del aviso de estado. No necesita credenciales, así que sirve también para la vista previa del admin. */
export function statusEmailContent(event: StatusNotification, templates: EmailTemplates = {}) {
  const status = orderStatusLabel(event.status);
  const trackingUrl = safeTrackingUrl(event.tracking_url);
  if (event.status === "shipped" && (!event.tracking_number || !trackingUrl)) throw new Error("Faltan los datos de seguimiento.");
  const variables = { nombre: event.buyer_name, numero_pedido: event.order_number, estado: status };
  const description = emailText(templates, `status.${event.status}`, variables);
  const footer = emailText(templates, "status.footer", variables);
  const tracking = event.status === "shipped"
    ? `<div style="margin:24px 0;padding:20px;background:#fff3f7;border-radius:12px"><h2 style="margin:0 0 12px;font-size:19px">Datos de seguimiento</h2>${event.carrier ? `<p>Empresa de envío: <strong>${escapeHtml(event.carrier)}</strong></p>` : ""}<p>Número de seguimiento:<br><strong style="font-size:20px;overflow-wrap:anywhere">${escapeHtml(event.tracking_number)}</strong></p><a href="${escapeHtml(trackingUrl!)}" style="display:inline-block;background:#d32665;color:#fff;padding:14px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Seguir mi envío</a><p style="margin-bottom:0;font-size:14px;overflow-wrap:anywhere">También puedes abrir este enlace:<br><a href="${escapeHtml(trackingUrl!)}" style="color:#a51c50">${escapeHtml(trackingUrl!)}</a></p></div>` : "";
  const text = [`Hola ${event.buyer_name},`, `Pedido #${event.order_number}`, `Estado: ${status}`, description,
    ...(event.status === "shipped" ? [event.carrier ? `Empresa de envío: ${event.carrier}` : "", `Número de seguimiento: ${event.tracking_number}`, `Seguir mi envío: ${trackingUrl}`] : []),
    footer, "Galletísima"].filter(Boolean).join("\n\n");
  return {
    subject: emailSubject(templates, "status.subject", variables),
    text,
    html: `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Actualización de tu pedido</title></head><body style="margin:0;background:#f8f3f5;font-family:Arial,Helvetica,sans-serif;color:#432e36"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #eedfe4;border-radius:16px"><tr><td style="padding:28px 24px;font-size:16px;line-height:1.6"><div style="font-size:25px;font-weight:bold;color:#d32665">Galletísima</div><p style="color:#795f69;margin-bottom:8px">PEDIDO #${escapeHtml(event.order_number)}</p><h1 style="font-size:28px;line-height:1.2;margin:0 0 24px">${status}</h1><p>Hola ${escapeHtml(event.buyer_name)},</p><p>${paragraph(description)}</p>${tracking}<p style="margin-top:28px;color:#795f69;font-size:14px">${paragraph(footer)}<br>Galletísima · Hecho con cariño en Chile</p></td></tr></table></td></tr></table></body></html>`,
  };
}

export function statusEmailPayload(event: StatusNotification, templates: EmailTemplates = {}): Record<string, unknown> {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("Falta configurar el remitente de correo.");
  if (!/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(event.recipient)) throw new Error("El pedido no tiene un correo válido.");
  const content = statusEmailContent(event, templates);
  return {
    from, to: [event.recipient],
    ...(process.env.SELLER_NOTIFICATION_EMAIL ? { reply_to: process.env.SELLER_NOTIFICATION_EMAIL } : {}),
    ...content,
  };
}

export async function sendStatusEmail(id: string, payload: Record<string, unknown>) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Resend no está configurado.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `order-status-${id}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Resend no aceptó el aviso (${response.status}).`);
  const result = await response.json();
  if (typeof result.id !== "string") throw new Error("No se pudo confirmar el envío del correo.");
  return result.id as string;
}
