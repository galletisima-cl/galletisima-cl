"use client";

import { useRef, useState } from "react";
import { CsvImportProduct, CsvImportPreview, parseProductCsv } from "../lib/product-csv-import";

export default function AdminProductCsvImporter({ loading, onImport }: { loading: boolean; onImport: (products: CsvImportProduct[]) => Promise<boolean> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<CsvImportPreview | null>(null);
  const [readError, setReadError] = useState("");
  const selectFile = async (file?: File) => {
    setReadError(""); setPreview(null); setFileName(file?.name || "");
    if (!file) return;
    if (!/\.(csv|xlsx)$/i.test(file.name)) return setReadError("Selecciona un archivo Excel (.xlsx) o CSV (.csv)");
    if (file.size > 5 * 1024 * 1024) return setReadError("El archivo supera el máximo permitido de 5 MB");
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import("read-excel-file/browser");
        const rows = await readSheet(file, "Productos");
        const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
        setPreview(parseProductCsv(csv));
      } else setPreview(parseProductCsv(await file.text()));
    } catch { setReadError("No fue posible leer el archivo. Comprueba que no esté dañado ni protegido."); }
  };
  const clear = () => { setFileName(""); setPreview(null); setReadError(""); if (inputRef.current) inputRef.current.value = ""; };
  return <section className="csv-import-card" aria-labelledby="csv-import-title">
    <div className="csv-import-heading"><span className="csv-import-icon" aria-hidden="true">⇧</span><div><h3 id="csv-import-title">Importar productos</h3><p>Completa la plantilla en celdas separadas y súbela directamente, sin convertirla. También se admiten archivos CSV.</p></div><a className="csv-template-download" href="/plantilla-productos-galletisima.xlsx" download="plantilla-productos-galletisima.xlsx"><span aria-hidden="true">↓</span> Descargar plantilla clara</a></div>
    <label className="csv-file-button"><input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.csv,text/csv" onChange={(event) => selectFile(event.target.files?.[0])} /><span>{fileName || "Seleccionar Excel o CSV"}</span></label>
    {readError && <p className="csv-import-error">{readError}</p>}
    {preview && <div className="csv-import-preview">
      <div className="csv-import-summary"><strong>{preview.products.length} productos</strong><span>{preview.sourceRows} filas procesadas</span><span>{preview.errors.length} errores</span><span>{preview.warnings.length} avisos</span></div>
      {preview.errors.length > 0 && <><ul className="csv-import-errors">{preview.errors.slice(0, 20).map((error) => <li key={error}>{error}</li>)}</ul>{preview.errors.length > 20 && <small>Hay {preview.errors.length - 20} errores adicionales. Corrige primero los mostrados y vuelve a seleccionar el archivo.</small>}</>}
      {preview.warnings.length > 0 && <ul className="csv-import-warnings">{preview.warnings.slice(0, 20).map((warning) => <li key={warning}>{warning}</li>)}</ul>}
      {!preview.errors.length && <div className="csv-preview-table"><div><b>Producto</b><b>SKU</b><b>Categorías</b><b>Variantes</b></div>{preview.products.slice(0, 6).map((product) => <div key={product.permalink}><span>{product.name}</span><span>{product.sku}</span><span>{product.categories.join(", ")}</span><span>{product.sizes.length || "—"}</span></div>)}</div>}
      {preview.products.length > 6 && !preview.errors.length && <small>Vista previa de 6 productos. Se importarán los {preview.products.length}.</small>}
      <div className="csv-import-actions"><button type="button" onClick={clear} disabled={loading}>Cancelar</button><button type="button" className="csv-import-confirm" disabled={loading || preview.errors.length > 0 || preview.products.length === 0} onClick={async () => { if (await onImport(preview.products)) clear(); }}>{loading ? "Importando…" : `Importar ${preview.products.length} productos`}</button></div>
    </div>}
  </section>;
}
