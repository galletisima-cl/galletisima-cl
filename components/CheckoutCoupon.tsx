"use client";

import { useState } from "react";
import type { CheckoutQuote } from "./useCheckoutQuote";

export default function CheckoutCoupon({ checkout, disabled }: { checkout: CheckoutQuote; disabled: boolean }) {
  const [draft, setDraft] = useState("");
  const { couponCode, pricing, quoteError, isQuoting, communeId } = checkout;
  const apply = () => { if (draft.trim() && !disabled && !isQuoting) checkout.applyCoupon(draft); };

  return <section className="checkout-coupon" aria-label="Cupón de descuento">
    <label htmlFor="checkout-coupon-code">Código de descuento <small>(opcional)</small></label>
    <div className="checkout-coupon-controls">
      <input id="checkout-coupon-code" value={draft} maxLength={40} placeholder="Ingresa tu código" autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={disabled}
        onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); apply(); } }} aria-describedby="checkout-coupon-status" />
      <button type="button" onClick={apply} disabled={disabled || isQuoting || !draft.trim()}>Aplicar</button>
    </div>
    <div id="checkout-coupon-status" aria-live="polite">
      {couponCode && <>
        <div className="checkout-coupon-selection"><strong>{couponCode}</strong><button type="button" disabled={disabled} onClick={() => { checkout.removeCoupon(); setDraft(""); }}>Quitar cupón</button></div>
        {!communeId ? <p>Selecciona una comuna para validar el cupón.</p> : isQuoting ? <p>Validando cupón…</p> : quoteError ? <p className="webpay-error">{quoteError}</p> : pricing?.coupon && <p className="checkout-discount">{pricing.coupon.applied ? "Cupón aplicado a tu compra." : "Ya tienes un beneficio igual o mayor; conservamos el mejor descuento."}</p>}
      </>}
    </div>
  </section>;
}
