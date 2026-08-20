export const DEFAULT_WHATSAPP_MESSAGE = "Hola! Me gusta el catálogo, pero tengo una duda…";

export function createWhatsappUrl(number: string, message = DEFAULT_WHATSAPP_MESSAGE) {
  const digits = number.replace(/\D/g, "");
  const params = new URLSearchParams({ text: message });
  return `https://wa.me/${digits}?${params.toString()}`;
}
