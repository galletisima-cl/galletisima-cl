"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { orderEmailHtml, orderEmailSubject } from "../lib/email";
import { EMAIL_GROUPS, EMAIL_TEMPLATES_SETTING_KEY, defaultEmailText, parseEmailTemplates, type EmailTemplates } from "../lib/email-templates";
import { statusEmailContent } from "../lib/order-status-email";
import { orderStatuses, type OrderStatus, type StatusNotification } from "../lib/order-status";
import type { StoredOrder } from "../lib/orders";

const allDefaults = () => Object.fromEntries(EMAIL_GROUPS.flatMap((group) => group.fields.map((field) => [field.key, field.defaultText])));

const sampleOrder: StoredOrder = {
  id: "preview", buy_order: "PREVIEW", public_order_number: "20261024001", total: 7600, discount_amount: 0,
  buyer_name: "Camila Rojas", buyer_email: "camila@ejemplo.cl", buyer_phone: "+56 9 1234 5678", shipping: 3500,
  shipping_region: "Región Metropolitana", shipping_commune: "La Florida", shipping_address: "Av. Ejemplo 123", shipping_address_extra: "Depto 45",
  payment_status: "authorized", authorization_code: "123456", payment_type_code: "VD", card_last_four: "4321",
  installments_number: 0, transaction_date: null, email_sent_at: null,
};
const sampleLines = [
  { name: "Cortador Stitch", size: "8 cm", quantity: 1, unit_price: 2000, line_total: 2000 },
  { name: "Cortador corazón", size: "10 cm", quantity: 1, unit_price: 2100, line_total: 2100 },
];
const sampleStatus = (status: OrderStatus): StatusNotification => ({
  id: "preview", order_id: "preview", status, order_number: sampleOrder.public_order_number, buyer_name: sampleOrder.buyer_name,
  recipient: sampleOrder.buyer_email, tracking_number: "BX123456789", tracking_url: "https://www.blue.cl/seguimiento", carrier: "BlueExpress",
  created_at: "", sent_at: null, first_attempt_at: null, email_payload: null,
});

export default function AdminEmailsPanel({ notify, fail }: { notify: (message: string) => void; fail: (message: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [values, setValues] = useState<Record<string, string>>(allDefaults);
  const [saved, setSaved] = useState<EmailTemplates>({});
  const [groupId, setGroupId] = useState(EMAIL_GROUPS[0].id);
  const [previewStatus, setPreviewStatus] = useState<OrderStatus>("preparing");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const lastField = useRef<{ key: string; element: HTMLInputElement | HTMLTextAreaElement } | null>(null);

  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", EMAIL_TEMPLATES_SETTING_KEY).maybeSingle().then(({ data, error }) => {
      setLoading(false);
      if (error) return fail(error.message);
      const stored = parseEmailTemplates(data?.value);
      setSaved(stored);
      setValues({ ...allDefaults(), ...stored });
    });
  }, [supabase, fail]);

  const group = EMAIL_GROUPS.find((item) => item.id === groupId)!;
  const templates = useMemo(() => parseEmailTemplates(values), [values]);
  const dirty = JSON.stringify(templates) !== JSON.stringify(saved);
  const customCount = (id: string) => EMAIL_GROUPS.find((item) => item.id === id)!.fields.filter((field) => templates[field.key]).length;

  const preview = useMemo(() => {
    try {
      if (group.id === "status") {
        const content = statusEmailContent(sampleStatus(previewStatus), templates);
        return { subject: content.subject, html: content.html };
      }
      const audience = group.id === "seller" ? "seller" : "buyer";
      return {
        subject: orderEmailSubject(sampleOrder, audience, templates),
        html: orderEmailHtml(sampleOrder, sampleLines, audience, templates).replaceAll("cid:galletisima-logo", "/galletisima-logo-email.png"),
      };
    } catch {
      return { subject: "", html: "" };
    }
  }, [group.id, previewStatus, templates]);

  function update(key: string, text: string) {
    setValues((current) => ({ ...current, [key]: text }));
  }

  function insertVariable(name: string) {
    const target = lastField.current;
    if (!target || !group.fields.some((field) => field.key === target.key)) return fail("Primero haz clic en el campo donde quieres insertar la variable.");
    const { element, key } = target;
    const token = `{${name}}`;
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? start;
    update(key, element.value.slice(0, start) + token + element.value.slice(end));
    requestAnimationFrame(() => { element.focus(); element.setSelectionRange(start + token.length, start + token.length); });
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("site_settings").upsert({ key: EMAIL_TEMPLATES_SETTING_KEY, value: JSON.stringify(templates) });
    setSaving(false);
    if (error) return fail(error.message);
    setSaved(templates);
    notify("Textos de correos guardados. Se usarán desde el próximo correo enviado.");
  }

  return <section className="emails-admin">
    <div className="emails-heading">
      <div>
        <h2>Textos de los correos</h2>
        <p>Cambia lo que dicen los correos automáticos. El diseño, los productos, los montos y los datos de seguimiento se completan solos.</p>
      </div>
      <button type="button" className="emails-save" onClick={save} disabled={!dirty || saving || loading}>{saving ? "Guardando…" : dirty ? "Guardar cambios" : "Guardado"}</button>
    </div>

    <div className="emails-tabs" role="tablist" aria-label="Correos">
      {EMAIL_GROUPS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={item.id === groupId} className={item.id === groupId ? "active" : ""} onClick={() => setGroupId(item.id)}>
        {item.title}{customCount(item.id) > 0 && <span>{customCount(item.id)} editado{customCount(item.id) === 1 ? "" : "s"}</span>}
      </button>)}
    </div>

    <div className="emails-layout">
      <div className="emails-editor">
        <p className="emails-description">{group.description}</p>
        <div className="emails-variables">
          <small>Variables (haz clic en un campo y luego en la variable):</small>
          {group.variables.map((name) => <button key={name} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => insertVariable(name)}>{`{${name}}`}</button>)}
        </div>
        {group.fields.map((field) => {
          const custom = Boolean(templates[field.key]);
          const common = {
            value: values[field.key] ?? "",
            disabled: loading,
            placeholder: defaultEmailText(field.key),
            onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(field.key, event.target.value),
            onFocus: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { lastField.current = { key: field.key, element: event.target }; },
          };
          return <label key={field.key} className={custom ? "custom" : ""}>
            <span>{field.label}{custom && <em>editado</em>}</span>
            {field.multiline ? <textarea rows={3} {...common} /> : <input type="text" {...common} />}
            {custom && <button type="button" className="emails-reset" onClick={() => update(field.key, defaultEmailText(field.key))}>Volver al texto original</button>}
          </label>;
        })}
        <p className="field-help">Si dejas un campo vacío, se usa el texto original.</p>
      </div>

      <div className="emails-preview">
        <div className="emails-preview-head">
          <strong>Vista previa</strong>
          {group.id === "status" && <select value={previewStatus} onChange={(event) => setPreviewStatus(event.target.value as OrderStatus)} aria-label="Estado a previsualizar">
            {orderStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>}
        </div>
        <p className="emails-subject"><small>Asunto</small>{preview.subject}</p>
        <iframe title="Vista previa del correo" sandbox="" srcDoc={preview.html} />
        <p className="field-help">Con datos de ejemplo. El correo real usa los datos de cada pedido.</p>
      </div>
    </div>
  </section>;
}
