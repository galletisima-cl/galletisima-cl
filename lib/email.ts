import type { StoredOrder } from "./orders";

type OrderLine = {
  name: string;
  size: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});
const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ] || character,
  );

function orderHtml(
  order: StoredOrder,
  lines: OrderLine[],
  audience: "buyer" | "seller",
) {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.galletisima.cl"
  ).replace(/\/$/, "");
  const orderNumber = order.public_order_number || order.buy_order;
  const subtotal = lines.reduce(
    (sum, line) => sum + Number(line.line_total),
    0,
  );
  const address = [order.shipping_address, order.shipping_address_extra]
    .filter(Boolean)
    .join(", ");
  const title =
    audience === "buyer" ? "¡Gracias por tu compra!" : "Nueva venta confirmada";
  const intro =
    audience === "buyer"
      ? `Hola ${escapeHtml(order.buyer_name)}, tu pago fue confirmado y ya comenzaremos a preparar tu pedido.`
      : `Se confirmó una nueva venta de ${escapeHtml(order.buyer_name)} mediante Webpay.`;
  const actionUrl =
    audience === "buyer" ? `${siteUrl}/seguimiento` : `${siteUrl}/admin`;
  const actionLabel =
    audience === "buyer"
      ? "Consultar seguimiento"
      : "Ver pedido en administración";
  const rows = lines
    .map(
      (line) =>
        `<tr><td style="padding:14px 0;border-bottom:1px solid #f0e4e8"><strong style="display:block;color:#422e35;font-size:14px">${escapeHtml(line.name)}</strong>${line.size ? `<span style="display:block;margin-top:3px;color:#8d747d;font-size:12px">Medida: ${escapeHtml(line.size)}</span>` : ""}</td><td style="padding:14px 8px;border-bottom:1px solid #f0e4e8;text-align:center;color:#665158;font-size:13px">${line.quantity}</td><td style="padding:14px 0;border-bottom:1px solid #f0e4e8;text-align:right;color:#422e35;font-size:13px;font-weight:700">${money.format(line.line_total)}</td></tr>`,
    )
    .join("");

  const discountRow = (order.discount_amount || 0) > 0
    ? `<tr><td style="padding:5px 0;color:#2d7b49;font-size:13px">Descuentos</td><td align="right" style="padding:5px 0;color:#2d7b49;font-size:13px">−${money.format(order.discount_amount || 0)}</td></tr>`
    : "";

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head><body style="margin:0;padding:0;background:#f8f3f5;font-family:Arial,Helvetica,sans-serif;color:#432e36"><div style="display:none;max-height:0;overflow:hidden;opacity:0">Pedido ${escapeHtml(orderNumber)} confirmado · Galletísima</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8f3f5"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #eedfe4;border-radius:20px;overflow:hidden"><tr><td align="center" style="padding:28px 30px 22px;background:transparent;border-bottom:1px solid #f0e3e7"><img src="cid:galletisima-logo" width="210" height="74" alt="Galletísima" style="display:block;width:210px;height:74px;object-fit:contain;background:transparent;border:0;outline:none;text-decoration:none"><div style="margin-top:14px;color:#d32665;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase">Compra 100% segura</div></td></tr><tr><td style="padding:34px 36px 18px"><h1 style="margin:0 0 12px;color:#d32665;font-size:30px;line-height:1.2">${title}</h1><p style="margin:0;color:#624d55;font-size:15px;line-height:1.65">${intro}</p><div style="margin-top:24px;padding:18px 20px;border-radius:14px;background:#fff3f7"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="color:#92747f;font-size:11px;font-weight:700;text-transform:uppercase">Número de pedido</td><td align="right" style="color:#d32665;font-size:18px;font-weight:800">${escapeHtml(orderNumber)}</td></tr></table></div></td></tr><tr><td style="padding:10px 36px"><h2 style="margin:0 0 10px;color:#432e36;font-size:17px">Productos</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><thead><tr><th align="left" style="padding:8px 0;color:#967c86;font-size:10px;text-transform:uppercase">Producto</th><th style="padding:8px;color:#967c86;font-size:10px;text-transform:uppercase">Cant.</th><th align="right" style="padding:8px 0;color:#967c86;font-size:10px;text-transform:uppercase">Subtotal</th></tr></thead><tbody>${rows}</tbody></table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:16px"><tr><td style="padding:5px 0;color:#806a73;font-size:13px">Productos</td><td align="right" style="padding:5px 0;color:#432e36;font-size:13px">${money.format(subtotal)}</td></tr>${discountRow}<tr><td style="padding:5px 0;color:#806a73;font-size:13px">Envío</td><td align="right" style="padding:5px 0;color:#432e36;font-size:13px">${order.shipping === 0 ? "Gratis" : money.format(order.shipping)}</td></tr><tr><td style="padding:14px 0 0;border-top:1px solid #eadde1;color:#432e36;font-size:17px;font-weight:800">Total pagado</td><td align="right" style="padding:14px 0 0;border-top:1px solid #eadde1;color:#d32665;font-size:21px;font-weight:900">${money.format(order.total)}</td></tr></table></td></tr><tr><td style="padding:26px 36px 8px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td valign="top" width="50%" style="padding:18px;background:#fbf8f9;border-radius:13px"><div style="margin-bottom:9px;color:#d32665;font-size:10px;font-weight:800;text-transform:uppercase">Datos del cliente</div><strong style="display:block;color:#432e36;font-size:13px">${escapeHtml(order.buyer_name)}</strong><span style="display:block;margin-top:5px;color:#735d65;font-size:12px;line-height:1.55">${escapeHtml(order.buyer_email)}${order.buyer_phone ? `<br>${escapeHtml(order.buyer_phone)}` : ""}</span></td><td width="12"></td><td valign="top" width="50%" style="padding:18px;background:#fbf8f9;border-radius:13px"><div style="margin-bottom:9px;color:#d32665;font-size:10px;font-weight:800;text-transform:uppercase">Dirección de envío</div><strong style="display:block;color:#432e36;font-size:13px">${escapeHtml(order.shipping_commune)}</strong><span style="display:block;margin-top:5px;color:#735d65;font-size:12px;line-height:1.55">${escapeHtml(address)}<br>${escapeHtml(order.shipping_region)}</span></td></tr></table></td></tr><tr><td style="padding:18px 36px"><div style="padding:18px;border:1px solid #eee1e5;border-radius:13px"><div style="margin-bottom:10px;color:#432e36;font-size:13px;font-weight:800">Información del pago</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:4px 0;color:#806a73;font-size:12px">Medio</td><td align="right" style="padding:4px 0;color:#432e36;font-size:12px;font-weight:700">Webpay</td></tr><tr><td style="padding:4px 0;color:#806a73;font-size:12px">Autorización</td><td align="right" style="padding:4px 0;color:#432e36;font-size:12px;font-weight:700">${escapeHtml(order.authorization_code || "—")}</td></tr><tr><td style="padding:4px 0;color:#806a73;font-size:12px">Tarjeta</td><td align="right" style="padding:4px 0;color:#432e36;font-size:12px;font-weight:700">•••• ${escapeHtml(order.card_last_four || "—")}</td></tr></table></div></td></tr><tr><td align="center" style="padding:12px 36px 34px"><a href="${actionUrl}" style="display:inline-block;padding:15px 23px;border-radius:11px;background:#d32665;color:#ffffff;font-size:13px;font-weight:800;text-decoration:none">${actionLabel}</a><p style="margin:22px 0 0;color:#927b84;font-size:11px;line-height:1.6">¿Tienes dudas? Responde este correo o escríbenos a ventas@galletisima.cl.<br>Galletísima · Hecho con cariño en Chile ♡</p></td></tr></table></td></tr></table></body></html>`;
}

export async function sendOrderEmails(order: StoredOrder, lines: OrderLine[]) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const seller = process.env.SELLER_NOTIFICATION_EMAIL;
  if (!apiKey || !from || !seller)
    throw new Error("Resend no está configurado.");
  const send = async (
    to: string,
    subject: string,
    html: string,
    idempotencyKey: string,
  ) => {
    const logoUrl = "https://www.galletisima.cl/galletisima-logo-email.png";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: seller,
        subject,
        html,
        attachments: [
          {
            path: logoUrl,
            filename: "galletisima-logo.png",
            content_id: "galletisima-logo",
          },
        ],
      }),
    });
    if (!response.ok)
      throw new Error(
        `Resend rechazó el correo (${response.status}): ${await response.text()}`,
      );
  };
  const orderNumber = order.public_order_number || order.buy_order;
  await Promise.all([
    send(
      order.buyer_email,
      `Pedido ${orderNumber} confirmado · Galletísima`,
      orderHtml(order, lines, "buyer"),
      `buyer-order-${order.id}`,
    ),
    send(
      seller,
      `Nueva venta confirmada · Pedido ${orderNumber}`,
      orderHtml(order, lines, "seller"),
      `seller-order-${order.id}`,
    ),
  ]);
}
