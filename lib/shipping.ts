import { communes, provinces, regions } from "@clregions/data";
import { createClient } from "@supabase/supabase-js";

export type ShippingOption = {
  communeId: string;
  commune: string;
  regionId: string;
  region: string;
  price: number;
  active: boolean;
};

const regionPrices: Record<string, number> = {
  "01": 8490, "02": 7990, "03": 7590, "04": 6490,
  "05": 4990, "06": 5290, "07": 5590, "08": 5990,
  "09": 6490, "10": 7490, "11": 10990, "12": 11990,
  "13": 3990, "14": 6990, "15": 8990, "16": 5990,
};

const remotePrices: Record<string, number> = {
  "05201": 19990, // Isla de Pascua
  "05104": 19990, // Juan Fernández
  "10206": 10990, // Quinchao
  "10208": 10990, // Puqueldón
  "10205": 10990, // Curaco de Vélez
  "11203": 13990, // Guaitecas
  "11302": 13990, // O'Higgins
  "11303": 13990, // Tortel
  "12202": 14990, // Antártica
  "12401": 14990, // Cabo de Hornos
};

const provinceById = new Map<string, (typeof provinces)[number]>(provinces.map((province) => [province.id, province]));
const regionById = new Map<string, (typeof regions)[number]>(regions.map((region) => [region.id, region]));

export function defaultShippingOptions(): ShippingOption[] {
  return communes.map((commune) => {
    const province = provinceById.get(commune.provinceId);
    const regionId = province?.regionId || "";
    const region = regionById.get(regionId);
    return {
      communeId: commune.id,
      commune: commune.name,
      regionId,
      region: region?.name || "",
      price: remotePrices[commune.id] || regionPrices[regionId] || 7990,
      active: commune.id !== "12202",
    };
  });
}

function serverSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase no está configurado.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getShippingOptions() {
  const defaults = defaultShippingOptions();
  const { data, error } = await serverSupabase().from("shipping_rates").select("commune_id,price,active");
  if (error) throw new Error("No pudimos consultar las tarifas de envío.");
  const overrides = new Map((data || []).map((row) => [String(row.commune_id), row]));
  return defaults.map((option) => {
    const override = overrides.get(option.communeId);
    return override ? { ...option, price: Number(override.price), active: Boolean(override.active) } : option;
  });
}

export async function calculateShipping(communeId: string) {
  const option = (await getShippingOptions()).find((candidate) => candidate.communeId === communeId);
  if (!option || !option.active) throw new Error("La comuna seleccionada no tiene despacho disponible.");
  return option;
}
