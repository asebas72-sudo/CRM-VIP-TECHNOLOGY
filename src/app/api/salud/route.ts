import { clientePublico } from "@/lib/supabase/publico";

export const dynamic = "force-dynamic";

/**
 * Ruta que visita cron-job.org cada 10 minutos para que Render no apague
 * el servidor y Supabase no pause la base de datos por inactividad.
 */
export async function GET() {
  const supabase = clientePublico();
  const { error } = await supabase.from("empresas").select("id").limit(1);

  // Memoria del servidor en MB, para vigilar el límite de Render gratis (512 MB)
  const m = process.memoryUsage();
  const mb = (n: number) => Math.round(n / 1048576);
  return Response.json(
    {
      ok: !error,
      baseDeDatos: error ? error.message : "conectada",
      memoriaMB: { total: mb(m.rss), heap: mb(m.heapUsed) },
      hora: new Date().toISOString(),
    },
    { status: error ? 503 : 200 },
  );
}
