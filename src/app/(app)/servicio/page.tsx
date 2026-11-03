import Link from "next/link";
import { exigirRol } from "@/lib/empresa";
import { pesos } from "@/lib/formato";
import { enlaceWhatsapp, ESTADOS_ORDEN, ESTILO_ESTADO_ORDEN, fechaCorta, type EstadoOrden } from "@/lib/servicio";
import { crearClienteServidor } from "@/lib/supabase/server";
import { tecnicosEmpresa } from "./datos";

type Orden = {
  id: string;
  consecutivo: number;
  codigo: string;
  cliente_nombre: string;
  cliente_documento: string;
  celular: string;
  equipo: string;
  tipo_equipo: string;
  marca: string;
  fallas: string | null;
  estado: EstadoOrden;
  tecnico_id: string | null;
  costo: number | null;
  fecha_ingreso: string;
  fecha_entrega_estimada: string | null;
};

const EN_PROCESO: EstadoOrden[] = ["TALLER", "EN PROCESO", "ESPERA REPUESTOS", "REVISADO"];

export default async function TableroServicio({ searchParams }: PageProps<"/servicio">) {
  const { activa } = await exigirRol("admin", "vendedor", "tecnico");
  const p = await searchParams;
  const q = (typeof p.q === "string" ? p.q : "").trim().toLowerCase();
  const estado = typeof p.estado === "string" ? p.estado : "";
  const tecnico = typeof p.tecnico === "string" ? p.tecnico : "";
  const verEntregados = p.entregados === "1" || estado === "ENTREGADO";

  const supabase = await crearClienteServidor();
  const [ordenesRes, tecnicos] = await Promise.all([
    supabase
      .from("ordenes_servicio")
      .select(
        "id, consecutivo, codigo, cliente_nombre, cliente_documento, celular, equipo, tipo_equipo, marca, fallas, estado, tecnico_id, costo, fecha_ingreso, fecha_entrega_estimada",
      )
      .eq("empresa_id", activa.id)
      .order("fecha_ingreso", { ascending: false })
      .limit(2000),
    tecnicosEmpresa(activa.id),
  ]);
  if (ordenesRes.error) throw new Error(ordenesRes.error.message);
  const todas = (ordenesRes.data ?? []) as Orden[];
  const nombreTecnico = new Map(tecnicos.map((t) => [t.usuario_id, t.nombre]));
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

  const conteo = (f: (o: Orden) => boolean) => todas.filter(f).length;
  const tarjetas = [
    { titulo: "Activas", valor: conteo((o) => o.estado !== "ENTREGADO"), filtro: "", borde: "border-slate-700" },
    { titulo: "Ingresadas", valor: conteo((o) => o.estado === "INGRESADO"), filtro: "INGRESADO", borde: "border-blue-500" },
    { titulo: "En proceso", valor: conteo((o) => EN_PROCESO.includes(o.estado)), filtro: "proceso", borde: "border-amber-500" },
    { titulo: "Listas para entrega", valor: conteo((o) => o.estado === "LISTO"), filtro: "LISTO", borde: "border-green-500" },
    { titulo: "Entregadas", valor: conteo((o) => o.estado === "ENTREGADO"), filtro: "ENTREGADO", borde: "border-violet-500" },
  ];

  const ordenes = todas.filter((o) => {
    if (estado === "proceso" ? !EN_PROCESO.includes(o.estado) : estado && o.estado !== estado) return false;
    if (!verEntregados && o.estado === "ENTREGADO") return false;
    if (tecnico === "sin" ? o.tecnico_id : tecnico && o.tecnico_id !== tecnico) return false;
    if (q) {
      const texto = `${o.codigo} ${o.cliente_nombre} ${o.cliente_documento} ${o.celular} ${o.equipo} ${o.marca} ${o.consecutivo}`.toLowerCase();
      if (!texto.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Órdenes de servicio</h1>
          <p className="text-sm text-slate-500">
            Equipos ingresados a reparación en {activa.nombre}
            {activa.rol === "tecnico" && " · ves tus órdenes y las que aún no tienen técnico"}
          </p>
        </div>
        <Link href="/servicio/ingreso" className="rounded-lg bg-violet-700 px-4 py-2 font-semibold text-white hover:bg-violet-800">
          + Nuevo ingreso
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tarjetas.map((t) => (
          <Link
            key={t.titulo}
            href={t.filtro ? `/servicio?estado=${encodeURIComponent(t.filtro)}` : "/servicio"}
            className={`rounded-xl border-l-4 bg-white p-4 ring-1 ring-slate-200 transition hover:shadow-md ${t.borde} ${
              estado === t.filtro ? "ring-2 ring-slate-900" : ""
            }`}
          >
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{t.titulo}</p>
            <p className="mt-1 text-3xl font-bold text-slate-900 tabular-nums">{t.valor}</p>
          </Link>
        ))}
      </div>

      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por código, cliente, cédula, celular o equipo..."
          className="min-w-64 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2"
        />
        <select name="estado" defaultValue={estado} className="rounded-lg border border-slate-300 bg-white px-3 py-2">
          <option value="">Todos los estados</option>
          <option value="proceso">En proceso (todos)</option>
          {ESTADOS_ORDEN.map((e) => (
            <option key={e} value={e}>
              {ESTILO_ESTADO_ORDEN[e].texto}
            </option>
          ))}
        </select>
        {activa.rol !== "tecnico" && (
          <select name="tecnico" defaultValue={tecnico} className="rounded-lg border border-slate-300 bg-white px-3 py-2">
            <option value="">Todos los técnicos</option>
            <option value="sin">Sin técnico</option>
            {tecnicos.map((t) => (
              <option key={t.usuario_id} value={t.usuario_id}>
                {t.nombre}
              </option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <input type="checkbox" name="entregados" value="1" defaultChecked={verEntregados} />
          Ver entregadas
        </label>
        <button className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">Filtrar</button>
      </form>

      <div className="max-h-[calc(100vh-18rem)] overflow-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 shadow-[inset_0_-1px_0_var(--color-slate-200)]">
            <tr>
              <th className="px-4 py-3 font-medium">Ingreso</th>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Equipo</th>
              <th className="px-4 py-3 font-medium">Falla reportada</th>
              <th className="px-4 py-3 font-medium">Técnico</th>
              <th className="px-4 py-3 text-right font-medium">Costo</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ordenes.map((o) => {
              const e = ESTILO_ESTADO_ORDEN[o.estado];
              const vencida = o.estado !== "ENTREGADO" && o.estado !== "LISTO" && o.fecha_entrega_estimada && o.fecha_entrega_estimada < hoy;
              const wa = enlaceWhatsapp(o.celular);
              return (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-600">
                    {fechaCorta(o.fecha_ingreso)}
                    {vencida && <span className="block text-xs font-semibold text-red-600">⚠ Pasó la fecha estimada</span>}
                  </td>
                  <td className="px-4 py-2">
                    <Link href={`/servicio/${o.id}`} className="font-mono font-semibold text-violet-700 hover:underline">
                      {o.codigo}
                    </Link>
                    <span className="block text-xs text-slate-500">Orden #{o.consecutivo}</span>
                  </td>
                  <td className="px-4 py-2">
                    <p className="font-medium text-slate-900">{o.cliente_nombre}</p>
                    <p className="text-xs text-slate-500">
                      {wa ? (
                        <a href={wa} target="_blank" rel="noreferrer" className="text-green-700 hover:underline">
                          📱 {o.celular}
                        </a>
                      ) : (
                        o.celular
                      )}
                    </p>
                  </td>
                  <td className="px-4 py-2">
                    <p className="text-slate-900">{o.equipo}</p>
                    <p className="text-xs text-slate-500">
                      {o.tipo_equipo} · {o.marca}
                    </p>
                  </td>
                  <td className="max-w-56 px-4 py-2 text-slate-600">
                    <p className="line-clamp-2">{o.fallas ?? "—"}</p>
                  </td>
                  <td className="px-4 py-2">
                    {o.tecnico_id ? nombreTecnico.get(o.tecnico_id) ?? "—" : <span className="text-amber-700">Sin asignar</span>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{o.costo != null ? pesos(o.costo) : "—"}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${e.clase}`}>
                      {e.icono} {e.texto}
                    </span>
                  </td>
                </tr>
              );
            })}
            {ordenes.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                  No hay órdenes con ese criterio.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
