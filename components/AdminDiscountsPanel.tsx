"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { DISCOUNTS_SETTING_KEY, MAX_DISCOUNT_RULES, parseDiscountRules, validateDiscountRule, type DiscountKind, type DiscountRule } from "../lib/discounts";

type Product = { id: string; name: string; sku: string; active: boolean };
type Draft = { id: string; name: string; kind: DiscountKind; active: boolean; valueType: "fixed" | "percentage"; value: string; minSubtotal: string; productId: string; mode: "automatic" | "coupon"; code: string };
const emptyDraft: Draft = { id: "", name: "", kind: "free_shipping", active: false, valueType: "percentage", value: "", minSubtotal: "", productId: "", mode: "automatic", code: "" };
const labels: Record<DiscountKind, string> = { free_shipping: "Envío gratis", order: "Descuento al total", product: "Descuento por producto", minimum_order: "Descuento por monto mínimo" };
const money = (value: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);

export default function AdminDiscountsPanel({ products, notify, fail }: { products: Product[]; notify: (message: string) => void; fail: (message: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [rules, setRules] = useState<DiscountRule[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let active = true;
    void supabase.from("site_settings").select("value").eq("key", DISCOUNTS_SETTING_KEY).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      try {
        if (error) throw new Error("No pudimos cargar los descuentos. Intenta nuevamente.");
        setRules(parseDiscountRules(data?.value));
        setLoaded(true);
        setLoadError("");
      } catch (caught) { setLoadError(caught instanceof Error ? caught.message : "No pudimos cargar los descuentos."); }
    });
    return () => { active = false; };
  }, [supabase, loadAttempt]);

  async function persist(nextRules: DiscountRule[], message: string) {
    if (!loaded || saving) return false;
    setSaving(true);
    try {
      const validated = parseDiscountRules(JSON.stringify(nextRules));
      const { error } = await supabase.from("site_settings").upsert({ key: DISCOUNTS_SETTING_KEY, value: JSON.stringify(validated), updated_at: new Date().toISOString() });
      if (error) throw new Error("No pudimos guardar los descuentos. Intenta nuevamente.");
      setRules(validated);
      notify(message);
      return true;
    } catch (caught) {
      fail(caught instanceof Error ? caught.message : "No pudimos guardar los descuentos.");
      return false;
    } finally { setSaving(false); }
  }

  async function saveDraft() {
    setFormError("");
    try {
      if (!draft.id && rules.length >= MAX_DISCOUNT_RULES) throw new Error(`Puedes guardar hasta ${MAX_DISCOUNT_RULES} descuentos. Elimina uno para crear otro.`);
      if (draft.mode === "coupon" && !draft.code.trim()) throw new Error("Ingresa el código que usará el cliente.");
      const next = validateDiscountRule({ ...draft, id: draft.id || crypto.randomUUID(), value: Number(draft.value), minSubtotal: Number(draft.minSubtotal), productId: draft.productId || null, code: draft.mode === "coupon" ? draft.code : null });
      if (next.kind === "product" && !products.some((product) => product.id === next.productId)) throw new Error("Selecciona un producto disponible en el catálogo.");
      const nextRules = draft.id ? rules.map((rule) => rule.id === draft.id ? next : rule) : [...rules, next];
      if (await persist(nextRules, next.active ? "Descuento guardado y activo." : "Descuento guardado como inactivo.")) setDraft(emptyDraft);
    } catch (caught) { setFormError(caught instanceof Error ? caught.message : "Revisa los datos del descuento."); }
  }

  function edit(rule: DiscountRule) {
    setDraft({ ...rule, value: String(rule.value || ""), minSubtotal: String(rule.minSubtotal || ""), productId: rule.productId || "", mode: rule.code ? "coupon" : "automatic", code: rule.code || "" });
    setFormError("");
    document.getElementById("discount-name")?.focus();
  }

  return <section className="discounts-admin">
    <header className="discounts-heading"><div><h2>Descuentos y promociones</h2><p>Crea promociones automáticas o cupones que el cliente ingresa al comprar.</p></div><span>{rules.filter((rule) => rule.active).length} activos</span></header>
    <p className="discounts-policy">Se aplica el mayor ahorro entre los descuentos por producto y el descuento al total. El envío gratis puede combinarse con ese beneficio. Los montos mínimos consideran los productos antes de descuentos, sin el envío.</p>
    {loadError ? <div className="discounts-load-error" role="alert"><p>{loadError}</p><button type="button" onClick={() => setLoadAttempt((value) => value + 1)}>Volver a cargar</button></div> : !loaded ? <p role="status">Cargando descuentos…</p> : <div className="discounts-layout">
      <section className="panel discount-editor">
        <h3>{draft.id ? "Editar descuento" : "Nuevo descuento"}</h3>
        <form onSubmit={(event) => { event.preventDefault(); void saveDraft(); }}>
          <fieldset disabled={saving}>
            <label htmlFor="discount-name">Nombre<input id="discount-name" required maxLength={80} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ej. Envío gratis desde $30.000" /></label>
            <label>Cómo se aplica<select value={draft.mode} onChange={(event) => setDraft({ ...draft, mode: event.target.value as Draft["mode"] })}><option value="automatic">Automáticamente</option><option value="coupon">Con código de cupón</option></select></label>
            {draft.mode === "coupon" && <label>Código del cupón<input required minLength={3} maxLength={40} pattern="[A-Za-z0-9_\-]{3,40}" value={draft.code} autoCapitalize="characters" autoComplete="off" spellCheck={false} onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })} placeholder="Ej. HALLOWEEN25" /><small>El cliente debe escribirlo al comprar. No distingue mayúsculas y minúsculas.</small></label>}
            <label>Tipo de descuento<select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as DiscountKind })}>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            {draft.kind === "product" && <label>Producto<select required value={draft.productId} onChange={(event) => setDraft({ ...draft, productId: event.target.value })}><option value="">Selecciona un producto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name}{product.active ? "" : " (inactivo)"}</option>)}</select><small>Se aplica a cada unidad y a todas las medidas de este producto.</small></label>}
            {draft.kind !== "free_shipping" && <div className="discount-value-fields"><label>Formato<select value={draft.valueType} onChange={(event) => setDraft({ ...draft, valueType: event.target.value as Draft["valueType"] })}><option value="percentage">Porcentaje (%)</option><option value="fixed">Monto fijo ($)</option></select></label><label>{draft.valueType === "percentage" ? "Porcentaje" : draft.kind === "product" ? "Descuento por unidad ($)" : "Descuento ($)"}<input required type="number" inputMode="numeric" min="1" max={draft.valueType === "percentage" ? 100 : 1_000_000_000} step="1" value={draft.value} onChange={(event) => setDraft({ ...draft, value: event.target.value })} /></label></div>}
            <label>Monto mínimo de compra ($)<input type="number" inputMode="numeric" required={draft.kind === "minimum_order"} min={draft.kind === "minimum_order" ? 1 : 0} step="1" value={draft.minSubtotal} onChange={(event) => setDraft({ ...draft, minSubtotal: event.target.value })} placeholder={draft.kind === "minimum_order" ? "Ej. 30000" : "Sin mínimo"} /><small>{draft.kind === "minimum_order" ? "El descuento se aplica desde este monto." : "Déjalo vacío para aplicar sin monto mínimo."}</small></label>
            <label className="discount-active"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /><span>Activar descuento al guardar</span></label>
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <div className="discount-editor-actions"><button type="submit" className="primary">{saving ? "Guardando…" : "Guardar descuento"}</button>{draft.id && <button type="button" onClick={() => { setDraft(emptyDraft); setFormError(""); }}>Cancelar edición</button>}</div>
          </fieldset>
        </form>
      </section>
      <section className="discount-list" aria-label="Descuentos guardados">
        {!rules.length ? <div className="panel discount-empty"><h3>Aún no hay descuentos</h3><p>Crea tu primera promoción con el formulario.</p></div> : rules.map((rule) => <article className="panel discount-card" key={rule.id}>
          <header><div><small>{labels[rule.kind]}</small><h3>{rule.name}</h3></div><span className={`discount-badge ${rule.active ? "active" : ""}`}>{rule.active ? "Activo" : "Inactivo"}</span></header>
          <p className="discount-benefit">{rule.kind === "free_shipping" ? "Despacho sin costo" : `${rule.valueType === "percentage" ? `${rule.value}%` : money(rule.value)} de descuento${rule.kind === "product" ? " por unidad" : " al total de productos"}`}</p>
          <p className="discount-application">{rule.code ? <>Con cupón: <strong>{rule.code}</strong></> : "Se aplica automáticamente"}</p>
          {rule.kind === "product" && <p>{products.find((product) => product.id === rule.productId)?.name || "Producto no disponible"}</p>}
          <p>{rule.minSubtotal ? `Desde ${money(rule.minSubtotal)} en productos` : "Sin monto mínimo de compra"}</p>
          <footer><button type="button" disabled={saving} onClick={() => edit(rule)}>Editar</button><button type="button" disabled={saving} onClick={() => void persist(rules.map((candidate) => candidate.id === rule.id ? { ...candidate, active: !rule.active } : candidate), rule.active ? "Descuento desactivado." : "Descuento activado.")}>{rule.active ? "Desactivar" : "Activar"}</button><button type="button" className="danger" disabled={saving} onClick={async () => { if (window.confirm(`¿Eliminar el descuento «${rule.name}»?`) && await persist(rules.filter((candidate) => candidate.id !== rule.id), "Descuento eliminado.")) { if (draft.id === rule.id) setDraft(emptyDraft); } }}>Eliminar</button></footer>
        </article>)}
      </section>
    </div>}
  </section>;
}
