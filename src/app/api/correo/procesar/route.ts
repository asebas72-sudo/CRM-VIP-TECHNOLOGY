import { timingSafeEqual } from "node:crypto";
import { revisarCorreo } from "@/lib/correo/procesar";

/**
 * Tarea programada (cron-job.org cada 15 minutos):
 *   https://<app>/api/correo/procesar?token=<CORREO_CRON_TOKEN>
 * Lee Gmail y guarda las facturas y pagos nuevos.
 */
export async function GET(request: Request) {
  const esperado = process.env.CORREO_CRON_TOKEN ?? "";
  const recibido = new URL(request.url).searchParams.get("token") ?? request.headers.get("x-token") ?? "";
  const valido =
    esperado.length >= 16 &&
    recibido.length === esperado.length &&
    timingSafeEqual(Buffer.from(recibido), Buffer.from(esperado));
  if (!valido) return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });

  try {
    const resultado = await revisarCorreo();
    return Response.json({ ok: true, ...resultado });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
