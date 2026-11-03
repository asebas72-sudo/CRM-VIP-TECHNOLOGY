import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la clave secreta de Supabase: salta las reglas de seguridad
 * (RLS) y permite crear usuarios. Solo en el servidor y SIEMPRE después de
 * verificar que quien lo usa es superadmin.
 */
export function crearClienteAdmin() {
  const clave = process.env.SUPABASE_SECRET_KEY;
  if (!clave) {
    throw new Error(
      "Falta la variable SUPABASE_SECRET_KEY (Supabase > Project Settings > API Keys > Secret keys). Agréguela en .env.local y en Render.",
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
