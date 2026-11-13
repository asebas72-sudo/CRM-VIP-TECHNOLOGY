import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;

/**
 * Cliente sin sesión (clave pública) para rutas abiertas: /api/salud y el catálogo.
 * Se crea una sola vez y sin renovación automática del token: en el servidor esa
 * renovación deja un temporizador vivo por cada cliente creado y la memoria crece
 * con cada visita hasta tumbar Render.
 */
export function clientePublico(): SupabaseClient {
  cliente ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cliente;
}
