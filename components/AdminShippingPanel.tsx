"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { defaultShippingOptions, type ShippingOption } from "../lib/shipping";

const money = (value: number) => `$${Math.round(value).toLocaleString("es-CL")}`;

export default function AdminShippingPanel({ notify, fail }: { notify: (message: string) => void; fail: (message: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [options, setOptions] = useState<ShippingOption[]>(() => defaultShippingOptions());
  const [regionId, setRegionId] = useState("13");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [regionPrice, setRegionPrice] = useState("");

  useEffect(() => {
    supabase.from("shipping_rates").select("commune_id,price,active").then(({ data, error }) => {
      if (error) return fail(error.message);
      const overrides = new Map((data || []).map((row) => [String(row.commune_id), row]));
      setOptions((current) => current.map((option) => {
        const override = overrides.get(option.communeId);
        return override ? { ...option, price: Number(override.price), active: Boolean(override.active) } : option;
      }));
    });
  }, [supabase, fail]);

  const regions = [...new Map(options.map((option) => [option.regionId, option.region])).entries()];
  const normalizedSearch = search.trim().toLocaleLowerCase("es-CL");
  const visible = options.filter((option) => option.regionId === regionId && (!normalizedSearch || option.commune.toLocaleLowerCase("es-CL").includes(normalizedSearch)));
  const enabled = options.filter((option) => option.active);
  const average = enabled.length ? Math.round(enabled.reduce((sum, option) => sum + option.price, 0) / enabled.length) : 0;

  function update(communeId: string, patch: Partial<ShippingOption>) {
    setOptions((current) => current.map((option) => option.communeId === communeId ? { ...option, ...patch } : option));
  }

  async function saveRows(rows: ShippingOption[], message: string) {
    setSaving(true);
    const { error } = await supabase.from("shipping_rates").upsert(rows.map((option) => ({ commune_id: option.communeId, price: Math.max(0, Math.round(option.price)), active: option.active, updated_at: new Date().toISOString() })));
    setSaving(false);
    if (error) return fail(error.message);
    notify(message);
  }

  function applyRegionPrice() {
    const price = Number(regionPrice);
    if (!Number.isInteger(price) || price < 0) return fail("Ingresa una tarifa regional válida.");
    setOptions((current) => current.map((option) => option.regionId === regionId ? { ...option, price } : option));
    setRegionPrice("");
  }

  const selectedRegion = regions.find(([id]) => id === regionId)?.[1] || "Región";

  return <section className="shipping-admin">
    <div className="shipping-metrics">
      <article><span>⌖</span><div><small>Cobertura nacional</small><strong>{enabled.length} comunas</strong><p>de {options.length} registradas</p></div></article>
      <article><span>▦</span><div><small>Regiones</small><strong>{regions.length}</strong><p>tarifas configurables</p></div></article>
      <article><span>$</span><div><small>Tarifa promedio</small><strong>{money(average)}</strong><p>por despacho</p></div></article>
    </div>
    <section className="panel shipping-panel">
      <div className="panel-title shipping-title"><div><h2>Tarifas de envío</h2><p>Valores referenciales editables por comuna. El checkout usa siempre el valor guardado aquí.</p></div><button type="button" disabled={saving} onClick={() => void saveRows(options, "Todas las tarifas de envío fueron guardadas.")}>{saving ? "Guardando…" : "Guardar todos los cambios"}</button></div>
      <div className="shipping-toolbar">
        <label><span>Región</span><select value={regionId} onChange={(event) => setRegionId(event.target.value)}>{regions.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
        <label><span>Buscar comuna</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ej. La Florida" /></label>
        <div className="shipping-bulk"><label><span>Tarifa para toda la región</span><input inputMode="numeric" value={regionPrice} onChange={(event) => setRegionPrice(event.target.value.replace(/\D/g, ""))} placeholder="$ 4.990" /></label><button type="button" onClick={applyRegionPrice}>Aplicar</button></div>
      </div>
      <div className="shipping-region-summary"><div><span>{selectedRegion}</span><strong>{options.filter((option) => option.regionId === regionId && option.active).length} comunas con despacho</strong></div><button type="button" disabled={saving} onClick={() => void saveRows(options.filter((option) => option.regionId === regionId), `Tarifas de ${selectedRegion} guardadas.`)}>Guardar región</button></div>
      <div className="shipping-table">
        <div className="shipping-row shipping-head"><span>Comuna</span><span>Tarifa</span><span>Estado</span><span /></div>
        {visible.map((option) => <div className="shipping-row" key={option.communeId}><div><strong>{option.commune}</strong><small>Código territorial {option.communeId}</small></div><label className="shipping-price"><span>$</span><input aria-label={`Tarifa ${option.commune}`} inputMode="numeric" value={option.price} onChange={(event) => update(option.communeId, { price: Number(event.target.value.replace(/\D/g, "")) || 0 })} /></label><label className="shipping-switch"><input type="checkbox" checked={option.active} onChange={(event) => update(option.communeId, { active: event.target.checked })} /><span>{option.active ? "Disponible" : "Sin despacho"}</span></label><button type="button" disabled={saving} onClick={() => void saveRows([option], `Tarifa de ${option.commune} guardada.`)}>Guardar</button></div>)}
        {!visible.length && <div className="shipping-empty">No encontramos comunas con ese nombre.</div>}
      </div>
    </section>
  </section>;
}
