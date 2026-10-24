// Textos editables de los correos. Se guardan en site_settings (clave EMAIL_TEMPLATES_SETTING_KEY)
// y solo se almacenan los campos que difieren del texto original: un campo vacío usa el original.

export const EMAIL_TEMPLATES_SETTING_KEY = "email_templates";
const MAX_LENGTH = 1500;

export type EmailTemplates = Record<string, string>;
export type EmailVariables = Record<string, string>;

export type EmailField = { key: string; label: string; defaultText: string; multiline?: boolean };
export type EmailGroup = { id: string; title: string; description: string; variables: string[]; fields: EmailField[] };

const statusDefaults: [status: string, label: string, text: string][] = [
  ["review", "Pendiente", "Tu pedido está pendiente de preparación."],
  ["preparing", "Preparando", "Estamos preparando tus productos con mucho cariño."],
  ["shipped", "Enviado", "Tu pedido ya está en camino. Puedes consultar su recorrido con los datos de seguimiento."],
  ["delivered", "Entregado", "Tu pedido figura como entregado. ¡Gracias por elegir Galletísima!"],
  ["cancelled", "Cancelado", "Tu pedido fue cancelado. Si necesitas ayuda, responde a este correo."],
];

export const EMAIL_GROUPS: EmailGroup[] = [
  {
    id: "buyer",
    title: "Compra confirmada",
    description: "Lo recibe el cliente cuando su pago por Webpay se confirma.",
    variables: ["nombre", "numero_pedido", "total"],
    fields: [
      { key: "buyer.subject", label: "Asunto", defaultText: "Pedido {numero_pedido} confirmado · Galletísima" },
      { key: "buyer.title", label: "Título", defaultText: "¡Gracias por tu compra!" },
      { key: "buyer.intro", label: "Texto principal", defaultText: "Hola {nombre}, tu pago fue confirmado y ya comenzaremos a preparar tu pedido.", multiline: true },
      { key: "buyer.button", label: "Texto del botón", defaultText: "Consultar seguimiento" },
      { key: "buyer.footer", label: "Despedida", defaultText: "¿Tienes dudas? Responde este correo o escríbenos a ventas@galletisima.cl.", multiline: true },
    ],
  },
  {
    id: "seller",
    title: "Aviso de nueva venta",
    description: "Te llega a ti cada vez que se confirma una venta.",
    variables: ["nombre", "numero_pedido", "total"],
    fields: [
      { key: "seller.subject", label: "Asunto", defaultText: "Nueva venta confirmada · Pedido {numero_pedido}" },
      { key: "seller.title", label: "Título", defaultText: "Nueva venta confirmada" },
      { key: "seller.intro", label: "Texto principal", defaultText: "Se confirmó una nueva venta de {nombre} mediante Webpay.", multiline: true },
      { key: "seller.button", label: "Texto del botón", defaultText: "Ver pedido en administración" },
    ],
  },
  {
    id: "status",
    title: "Estados del pedido",
    description: "Lo recibe el cliente cuando cambias el estado de su pedido.",
    variables: ["nombre", "numero_pedido", "estado"],
    fields: [
      { key: "status.subject", label: "Asunto (todos los estados)", defaultText: "Pedido {numero_pedido} · {estado} · Galletísima" },
      ...statusDefaults.map(([status, label, text]) => ({ key: `status.${status}`, label: `Mensaje: ${label}`, defaultText: text, multiline: true })),
      { key: "status.footer", label: "Despedida", defaultText: "¿Necesitas ayuda? Responde a este correo indicando tu número de pedido.", multiline: true },
    ],
  },
];

const defaults = new Map(EMAIL_GROUPS.flatMap((group) => group.fields.map((field) => [field.key, field.defaultText] as const)));

export function defaultEmailText(key: string) {
  return defaults.get(key) ?? "";
}

/** Acepta el JSON guardado (o un objeto) y deja solo campos conocidos, de texto y distintos del original. */
export function parseEmailTemplates(raw: unknown): EmailTemplates {
  let value = raw;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return {}; }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const clean: EmailTemplates = {};
  for (const [key, text] of Object.entries(value as Record<string, unknown>)) {
    if (!defaults.has(key) || typeof text !== "string") continue;
    const trimmed = text.trim().slice(0, MAX_LENGTH);
    if (trimmed && trimmed !== defaults.get(key)) clean[key] = trimmed;
  }
  return clean;
}

/** Texto final (personalizado u original) con las variables {así} reemplazadas. Devuelve texto plano, sin escapar. */
export function emailText(templates: EmailTemplates | undefined, key: string, variables: EmailVariables) {
  const template = templates?.[key]?.trim() || defaultEmailText(key);
  return template.replace(/\{([a-z_]+)\}/g, (match, name: string) => (name in variables ? variables[name] : match));
}

/** Para asuntos: una sola línea. */
export function emailSubject(templates: EmailTemplates | undefined, key: string, variables: EmailVariables) {
  return emailText(templates, key, variables).replace(/[\r\n]+/g, " ").trim();
}
