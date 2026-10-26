"use client";

import { useEffect } from "react";
import { trackGaPurchase, type GaItem } from "../lib/analytics";

// Se muestra solo con el pago aprobado. GA4 ignora compras repetidas con el mismo
// transaction_id, así que recargar la página no duplica la venta.
export default function GaPurchase({ transactionId, value, items }: { transactionId: string; value: number; items: GaItem[] }) {
  useEffect(() => {
    trackGaPurchase({ transactionId, value, items });
  }, [transactionId, value, items]);
  return null;
}
