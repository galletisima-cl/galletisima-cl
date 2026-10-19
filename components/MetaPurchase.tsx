"use client";

import { useEffect } from "react";
import { trackMetaPurchase } from "../lib/meta-pixel";

type PurchaseItem = { id: string; quantity: number; item_price: number };

export default function MetaPurchase({ orderId, value, items }: { orderId: string; value: number; items: PurchaseItem[] }) {
  useEffect(() => {
    trackMetaPurchase(orderId, {
      content_ids: items.map((item) => item.id),
      contents: items,
      content_type: "product",
      currency: "CLP",
      num_items: items.reduce((count, item) => count + item.quantity, 0),
      value,
    });
  }, [items, orderId, value]);

  return null;
}
