import Link from "next/link";
import { sesionActual } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioMejora, GestionMejora } from "./formulario";
import { AREAS, ESTADOS, ESTILO_ESTADO, ESTILO_PRIORIDAD, PRIORIDADES, TIPO_CORTO } from "./opciones";

type Mejora = {
  id: string;
  empresa_id: string | null;
  usuario_id: string;
  tipo: string;
  area: string;
  titulo: string;
  descripcion: string;
  prioridad: string;
  estado: string;
  respuesta: string | null;
  creado_en: string;
};

const fechaHora = (v: string) =>
  new Date(v).toLocaleString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export type Parametros = Promise<Record<string, string | string[] | undefined>>;

/** Misma pantalla en el módulo de ventas (/mejoras) y en servicio técnico (/servicio/mejoras). */
export async function VistaMejoras({ ruta, searchParams }: { ruta: string; searchParams: Parametros }) {
  const { perfil, todas } = await sesionActual();
  const esGestor = perfil.acceso_total;
  const p = await searchParams;
  const filtro = typeof p.estado === "string" && p.estado in ESTADOS ? p.estado : "";

  const supabase = await crearClienteServidor();
  let consulta = supabase
    .from("mejoras")
    .select("id, empresa_id, usuario_id, tipo, area, titulo, descripcion, prioridad, estado, respuesta, creado_en")
    .order("creado_en", { ascending: false })
    .limit(300);
  if (!esGestor) consulta = consulta.eq("usuario_id", perfil.usuario_id);
  if (filtro) consulta = consulta.eq("estado", filtro);
  const { data, error } = await consulta;

  const mejoras = (data ?? []) as Mejora[];
  const nombreEmpresa = new Map(todas.map((e) => [e.id, e.nombre]));

  // Nombre de quien pidió cada mejora (solo lo ve el gestor)
  const nombres = new Map<string, string>();
  if (esGestor && mejoras.length) {
    const { data: perfiles } = await supabase
      .from("perfiles")
      .select("usuario_id, nombre, correo")
      .in("usuario_id", [...new Set(mejoras.map((m) => m.usuario_id))]);
    for (const x of perfiles ?? []) nombres.set(x.usuario_id, x.nombre || x.correo);
  }

  const conteo = (e: string) => mejoras.filter((m) => m.estado === e).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mejoras</h1>
        <p className="text-sm text-slate-500">
          ¿Qué le mejoraría al sistema o qué le hace falta? Escríbalo aquí: el equipo lo revisa y le responde en esta misma página.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          Esta opción aún no está lista en la base de datos (falta ejecutar la migración 0017_mejoras.sql). Detalle: {error.message}
        </p>
      ) : (
        <>
          <FormularioMejora />

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900">{esGestor ? "Todas las solicitudes" : "Mis solicitudes"}</h2>
              {esGestor && (
                <div className="flex flex-wrap gap-1 rounded-lg bg-white p-1 text-sm ring-1 ring-slate-200">
                  <Link
                    href={ruta}
                    className={`rounded-md px-3 py-1 font-medium ${filtro ? "text-slate-600 hover:bg-slate-100" : "bg-slate-900 text-white"}`}
                  >
                    Todas
                  </Link>
                  {Object.entries(ESTADOS).map(([v, t]) => (
                    <Link
                      key={v}
                      href={`${ruta}?estado=${v}`}
                      className={`rounded-md px-3 py-1 font-medium ${filtro === v ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                    >
                      {t}
                      {!filtro && conteo(v) > 0 && <span className="ml-1 text-xs opacity-70">({conteo(v)})</span>}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {mejoras.length === 0 ? (
              <p className="rounded-2xl bg-white px-5 py-8 text-center text-sm text-slate-500 ring-1 ring-slate-200">
                {filtro ? "No hay solicitudes en este estado." : "Todavía no hay solicitudes."}
              </p>
            ) : (
              <ul className="space-y-3">
                {mejoras.map((m) => (
                  <li key={m.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">{m.titulo}</p>
                        <p className="text-xs text-slate-500">
                          {TIPO_CORTO[m.tipo] ?? m.tipo} · {AREAS[m.area] ?? m.area} ·{" "}
                          <span className={ESTILO_PRIORIDAD[m.prioridad]}>{PRIORIDADES[m.prioridad] ?? m.prioridad}</span> · {fechaHora(m.creado_en)}
                          {esGestor && (
                            <>
                              {" "}
                              · {nombres.get(m.usuario_id) ?? "Usuario"}
                              {m.empresa_id && nombreEmpresa.get(m.empresa_id) && ` (${nombreEmpresa.get(m.empresa_id)})`}
                            </>
                          )}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTILO_ESTADO[m.estado] ?? ""}`}>
                        {ESTADOS[m.estado] ?? m.estado}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{m.descripcion}</p>
                    {m.respuesta && (
                      <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">
                        <span className="font-semibold">Respuesta: </span>
                        {m.respuesta}
                      </p>
                    )}
                    {esGestor && (
                      <div className="mt-2">
                        <GestionMejora id={m.id} estado={m.estado} respuesta={m.respuesta} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
