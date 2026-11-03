import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * Ruta que visita cron-job.org cada 10 minutos para que Render no apague
 * el servidor y Supabase no pause la base de datos por inactividad.
 */
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
  const { error } = await supabase.from("empresas").select("id").limit(1);

  return Response.json(
    { ok: !error, baseDeDatos: error ? error.message : "conectada", hora: new Date().toISOString() },
    { status: error ? 503 : 200 },
  );
}
