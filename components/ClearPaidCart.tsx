"use client";

import { useEffect } from "react";
import { clearCart } from "../lib/cart";

export default function ClearPaidCart() {
  useEffect(() => { clearCart(); }, []);
  return null;
}
