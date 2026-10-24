import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { EMAIL_TEMPLATES_SETTING_KEY, parseEmailTemplates, type EmailTemplates } from "./email-templates";

/** Lee los textos guardados en el admin. Si algo falla, devuelve {} y los correos salen con los textos originales. */
export async function loadEmailTemplates(client?: SupabaseClient): Promise<EmailTemplates> {
  try {
    let supabase = client;
    if (!supabase) {
      const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
      if (!url || !key) return {};
      supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    }
    const { data, error } = await supabase.from("site_settings").select("value").eq("key", EMAIL_TEMPLATES_SETTING_KEY).maybeSingle();
    if (error || !data) return {};
    return parseEmailTemplates(data.value);
  } catch {
    return {};
  }
}
