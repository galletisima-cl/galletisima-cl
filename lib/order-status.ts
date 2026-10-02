export const orderStatuses = [
  ["review", "Pendiente"], ["preparing", "Preparando"], ["shipped", "Enviado"],
  ["delivered", "Entregado"], ["cancelled", "Cancelado"],
] as const;

export type OrderStatus = typeof orderStatuses[number][0];
export const orderStatusLabel = (status: string) => orderStatuses.find(([value]) => value === status)?.[1] || "Pendiente";

export function safeTrackingUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048 || [...value].some(char => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password && url.hostname.includes(".") ? url.href : null;
  } catch { return null; }
}

export type StatusNotification = {
  id: string; order_id: string; status: OrderStatus; order_number: string;
  buyer_name: string; recipient: string; tracking_number: string; tracking_url: string; carrier: string;
  created_at: string; sent_at: string | null; first_attempt_at: string | null;
  email_payload: Record<string, unknown> | null;
};
