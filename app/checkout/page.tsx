import type { Metadata } from "next";
import CheckoutPage from "../../components/CheckoutPage";
import { getWebpayEnvironment } from "../../lib/webpay";

export const metadata: Metadata = {
  title: "Finalizar compra | Galletísima",
  description: "Completa tus datos de envío y paga de forma segura con Webpay.",
};

export default function Checkout() {
  return <CheckoutPage isIntegration={getWebpayEnvironment() === "integration"} />;
}
