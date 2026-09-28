import Link from "next/link";
import ClearPaidCart from "../../../components/ClearPaidCart";
import { getWebpayEnvironment, getWebpayTransaction } from "../../../lib/webpay";
import { sendOrderEmails } from "../../../lib/email";
import { findOrderByToken, getOrderLines, markOrderEmailSent, updateOrderPayment, type StoredOrder } from "../../../lib/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PaymentResultPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = valueOf(params.token_ws);
  const wasCancelled = Boolean(valueOf(params.TBK_TOKEN) || valueOf(params.TBK_ORDEN_COMPRA));
  let result: Record<string, unknown> | null = null;
  let order: StoredOrder | null = null;
  let error = "";

  if (token) {
    try {
      order = await findOrderByToken(token);
      if (!order) throw new Error("No encontramos el pedido asociado al pago.");
      if (order.payment_status === "authorized") {
        result = { status: "AUTHORIZED", response_code: 0, amount: order.total, buy_order: order.buy_order, authorization_code: order.authorization_code, card_detail: { card_number: order.card_last_four } };
      } else {
        result = await getWebpayTransaction().commit(token) as unknown as Record<string, unknown>;
        const authorized = result.status === "AUTHORIZED" && result.response_code === 0 && Number(result.amount) === Number(order.total) && result.buy_order === order.buy_order;
        order = await updateOrderPayment(order.id, result, authorized ? "authorized" : "rejected");
      }
      if (order.payment_status === "authorized" && !order.email_sent_at) {
        try {
          const lines = await getOrderLines(order.id);
          await sendOrderEmails(order, lines);
          await markOrderEmailSent(order.id);
        } catch (emailError) {
          console.error("Pago confirmado, pero no se pudieron enviar los correos", emailError);
        }
      }
    } catch (caught) {
      console.error("No se pudo confirmar la transacción Webpay", caught);
      error = "No fue posible confirmar el pago. Si ves un cobro, contáctanos antes de intentarlo nuevamente.";
    }
  }

  const approved = result?.status === "AUTHORIZED" && result?.response_code === 0;
  const amount = Number(result?.amount || 0);
  const currency = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

  return <main className="payment-page">
    <section className={`payment-card ${approved ? "approved" : "rejected"}`}>
      {approved && <ClearPaidCart />}
      <span className="payment-icon" aria-hidden="true">{approved ? "✓" : "!"}</span>
      <p className="eyebrow">Webpay Plus · {getWebpayEnvironment() === "integration" ? "Modo de prueba" : "Pago en línea"}</p>
      <h1>{approved ? getWebpayEnvironment() === "integration" ? "Pago de prueba aprobado" : "Pago aprobado" : wasCancelled ? "Pago cancelado" : "Pago no completado"}</h1>
      <p>{approved ? getWebpayEnvironment() === "integration" ? "La transacción de prueba fue autorizada y el pedido quedó registrado. No se realizó un cobro real." : "Tu pago fue autorizado correctamente. Enviamos el comprobante a tu correo." : error || "La transacción fue cancelada o rechazada. Tu carrito sigue disponible."}</p>
      {approved && <dl className="payment-details">
        <div><dt>Orden</dt><dd>{String(result?.buy_order || "—")}</dd></div>
        <div><dt>Monto</dt><dd>{currency.format(amount)}</dd></div>
        <div><dt>Autorización</dt><dd>{String(result?.authorization_code || "—")}</dd></div>
        <div><dt>Tarjeta</dt><dd>•••• {String((result?.card_detail as { card_number?: string } | undefined)?.card_number || "—")}</dd></div>
      </dl>}
      <Link className="payment-return" href="/">Volver a la tienda</Link>
    </section>
  </main>;
}
