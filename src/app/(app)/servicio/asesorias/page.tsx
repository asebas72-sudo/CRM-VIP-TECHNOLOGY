import Link from "next/link";
import { exigirRol } from "@/lib/empresa";
import { pesos } from "@/lib/formato";
import { enlaceWhatsapp, ESTADOS_ASESORIA, ESTILO_ESTADO_ASESORIA, fechaCorta, fechaHora, type EstadoAsesoria } from "@/lib/servicio";
import { crearClienteServidor } from "@/lib/supabase/server";
import { tecnicosEmpresa } from "../datos";

type Asesoria = {
  id: string;
  consecutivo: number;
  fecha: string;
  cliente_nombre: string;
  cliente_documento: string;
  celular: string;
  solicitud: string;
  fallas: string | null;
  estado: EstadoAsesoria;
  tecnico_id: string | null;
  fecha_visita: string | null;
  costo: number | null;
};

export default async function PaginaAsesorias({ searchParams }: PageProps<"/servicio/asesorias">) {
  const { activa } = await exigirRol("admin", "vendedor", "tecnico");
  const p = await searchParams;
  const q = (typeof p.q === "string" ? p.q : "").trim().toLowerCase();
  const estado = typeof p.estado === "string" ? p.estado : "";

  const supabase = await crearClienteServidor();
  const [res, tecnicos] = await Promise.all([
    supabase
      .from("asesorias")
      .select("id, consecutivo, fecha, cliente_nombre, cliente_documento, celular, solicitud, fallas, estado, tecnico_id, fecha_visita, costo")
      .eq("empresa_id", activa.id)
      .order("fecha", { ascending: false })
      .limit(2000),
    tecnicosEmpresa(activa.id),
  ]);
  if (res.error) throw new Error(res.error.message);
  const todas = (res.data ?? []) as Asesoria[];
  const nombreTecnico = new Map(tecnicos.map((t) => [t.usuario_id, t.nombre]));

  const lista = todas.filter((a) => {
    if (estado && a.estado !== estado) return false;
    if (q && !`${a.consecutivo} ${a.cliente_nombre} ${a.cliente_documento} ${a.celular} ${a.solicitud}`.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Asesorías</h1>
          <p className="text-sm text-slate-500">Solicitudes de asesoría y visitas técnicas en {activa.nombre}</p>
        </div>
        <Link href="/servicio/asesorias/nueva" className="rounded-lg bg-violet-700 px-4 py-2 font-semibold text-white hover:bg-violet-800">
          + Nueva asesoría
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tarjeta titulo="Todas" valor={todas.length} href="/servicio/asesorias" activa={!estado} />
        {ESTADOS_ASESORIA.map((e) => (
          <Tarjeta
            key={e}
            titulo={`${ESTILO_ESTADO_ASESORIA[e].icono} ${ESTILO_ESTADO_ASESORIA[e].texto}`}
            valor={todas.filter((a) => a.estado === e).length}
            href={`/servicio/asesorias?estado=${e}`}
            activa={estado === e}
          />
        ))}
      </div>

      <form className="flex flex-wrap gap-2">
        {estado && <input type="hidden" name="estado" value={estado} />}
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por número, cliente, cédula, celular o solicitud..."
          className="min-w-64 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2"
        />
        <button className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">Buscar</button>
      </form>

      <div className="max-h-[calc(100vh-18rem)] overflow-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 shadow-[inset_0_-1px_0_var(--color-slate-200)]">
            <tr>
              <th className="px-4 py-3 font-medium">No.</th>
              <th className="px-4 py-3 font-medium">Solicitada</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Solicitud</th>
              <th className="px-4 py-3 font-medium">Técnico</th>
              <th className="px-4 py-3 font-medium">Visita</th>
              <th className="px-4 py-3 text-right font-medium">Costo</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lista.map((a) => {
              const e = ESTILO_ESTADO_ASESORIA[a.estado];
              const wa = enlaceWhatsapp(a.celular);
              return (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/servicio/asesorias/${a.id}`} className="font-semibold text-violet-700 hover:underline">
                      #{a.consecutivo}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{fechaCorta(a.fecha)}</td>
                  <td className="px-4 py-2">
                    <p className="font-medium text-slate-900">{a.cliente_nombre}</p>
                    {wa ? (
                      <a href={wa} target="_blank" rel="noreferrer" className="text-xs text-green-700 hover:underline">
                        📱 {a.celular}
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500">{a.celular}</span>
                    )}
                  </td>
                  <td className="max-w-56 px-4 py-2">
                    <p className="text-slate-900">{a.solicitud}</p>
                    {a.fallas && <p className="line-clamp-1 text-xs text-slate-500">{a.fallas}</p>}
                  </td>
                  <td className="px-4 py-2">
                    {a.tecnico_id ? nombreTecnico.get(a.tecnico_id) ?? "—" : <span className="text-amber-700">Sin asignar</span>}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{a.fecha_visita ? fechaHora(a.fecha_visita) : "Por agendar"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{a.costo != null ? pesos(a.costo) : "—"}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${e.clase}`}>
                      {e.icono} {e.texto}
                    </span>
                  </td>
                </tr>
              );
            })}
            {lista.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                  No hay asesorías con ese criterio.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tarjeta({ titulo, valor, href, activa }: { titulo: string; valor: number; href: string; activa: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-xl bg-white p-4 ring-1 transition hover:shadow-md ${activa ? "ring-2 ring-slate-900" : "ring-slate-200"}`}
    >
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{titulo}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900 tabular-nums">{valor}</p>
    </Link>
  );
}
