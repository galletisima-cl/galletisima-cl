"use client";

import { useRef, useState } from "react";
import { CsvImportProduct, CsvImportPreview, parseProductCsv } from "../lib/product-csv-import";

export default function AdminProductCsvImporter({ loading, onImport }: { loading: boolean; onImport: (products: CsvImportProduct[]) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<CsvImportPreview | null>(null);
  const [readError, setReadError] = useState("");
  const selectFile = async (file?: File) => {
    setReadError(""); setPreview(null); setFileName(file?.name || "");
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) return setReadError("Selecciona un archivo con extensión .csv");
    try { setPreview(parseProductCsv(await file.text())); }
    catch { setReadError("No fue posible leer el archivo CSV"); }
  };
  const clear = () => { setFileName(""); setPreview(null); setReadError(""); if (inputRef.current) inputRef.current.value = ""; };
  return <section className="csv-import-card" aria-labelledby="csv-import-title">
    <div><span className="csv-import-icon" aria-hidden="true">⇧</span><div><h3 id="csv-import-title">Importar productos por CSV</h3><p>Compatible con Permalink, variantes de tamaño, categorías, imágenes, precio, stock y estado.</p></div></div>
    <label className="csv-file-button"><input ref={inputRef} type="file" accept=".csv,text/csv" onChange={(event) => selectFile(event.target.files?.[0])} /><span>{fileName || "Seleccionar archivo CSV"}</span></label>
    {readError && <p className="csv-import-error">{readError}</p>}
    {preview && <div className="csv-import-preview">
      <div className="csv-import-summary"><strong>{preview.products.length} productos</strong><span>{preview.sourceRows} filas procesadas</span><span>{preview.errors.length} errores</span><span>{preview.warnings.length} avisos</span></div>
      {preview.errors.length > 0 && <ul className="csv-import-errors">{preview.errors.slice(0, 8).map((error) => <li key={error}>{error}</li>)}</ul>}
      {!preview.errors.length && <div className="csv-preview-table"><div><b>Producto</b><b>SKU</b><b>Categorías</b><b>Variantes</b></div>{preview.products.slice(0, 6).map((product) => <div key={product.permalink}><span>{product.name}</span><span>{product.sku}</span><span>{product.categories.join(", ")}</span><span>{product.sizes.length || "—"}</span></div>)}</div>}
      {preview.products.length > 6 && !preview.errors.length && <small>Vista previa de 6 productos. Se importarán los {preview.products.length}.</small>}
      <div className="csv-import-actions"><button type="button" onClick={clear} disabled={loading}>Cancelar</button><button type="button" className="csv-import-confirm" disabled={loading || preview.errors.length > 0 || preview.products.length === 0} onClick={() => onImport(preview.products)}>{loading ? "Importando…" : `Importar ${preview.products.length} productos`}</button></div>
    </div>}
  </section>;
}
