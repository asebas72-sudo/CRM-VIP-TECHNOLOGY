import Link from "next/link";
import { exigirRol } from "@/lib/empresa";
import { pesos } from "@/lib/formato";
import { crearClienteServidor } from "@/lib/supabase/server";
import { BotonBorrarGasto, FormularioGasto } from "./formulario";
import { FORMAS_PAGO_GASTO, nombreCategoria, TIPOS_GASTO } from "./opciones";

type Gasto = {
  id: string;
  fecha: string;
  tipo: string;
  categoria: string;
  descripcion: string;
  valor: number;
  forma_pago: string;
  beneficiario: string | null;
};

function sumarMes(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export default async function PaginaGastos({ searchParams }: PageProps<"/gastos">) {
  const { activa } = await exigirRol("admin", "bodega", "vendedor");
  const esAdmin = activa.rol === "admin";
  const p = await searchParams;
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const mes = typeof p.mes === "string" && /^\d{4}-\d{2}$/.test(p.mes) ? p.mes : hoy.slice(0, 7);
  const finMes = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const nombreMes = new Date(`${mes}-15T12:00:00Z`).toLocaleDateString("es-CO", { month: "long", year: "numeric", timeZone: "UTC" });

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("gastos")
    .select("id, fecha, tipo, categoria, descripcion, valor, forma_pago, beneficiario")
    .eq("empresa_id", activa.id)
    .gte("fecha", `${mes}-01`)
    .lte("fecha", finMes)
    .order("fecha", { ascending: false })
    .order("creado_en", { ascending: false })
    .limit(1000);

  const gastos = (data ?? []) as Gasto[];
  const total = (tipo: string) => gastos.filter((g) => g.tipo === tipo).reduce((s, g) => s + Number(g.valor), 0);
  const fecha = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Gastos e inversiones de {activa.nombre}</h1>
        <p className="text-sm text-slate-500">
          Registre aquí el dinero que sale y no es compra de mercancía. Se descuenta en el cuadre de Informes.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          Esta opción aún no está lista en la base de datos (falta ejecutar la migración 0018_gastos.sql). Detalle: {error.message}
        </p>
      ) : (
        <>
          <FormularioGasto hoy={hoy} />

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 rounded-lg bg-white p-1 text-sm ring-1 ring-slate-200">
                <Link href={`/gastos?mes=${sumarMes(mes, -1)}`} className="rounded-md px-3 py-1 font-medium text-slate-600 hover:bg-slate-100">
                  ←
                </Link>
                <span className="px-2 font-semibold capitalize text-slate-900">{nombreMes}</span>
                {mes < hoy.slice(0, 7) && (
                  <Link href={`/gastos?mes=${sumarMes(mes, 1)}`} className="rounded-md px-3 py-1 font-medium text-slate-600 hover:bg-slate-100">
                    →
                  </Link>
                )}
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="rounded-lg bg-red-50 px-3 py-1.5 text-red-800 ring-1 ring-red-200">
                  Gastos <strong className="tabular-nums">{pesos(total("gasto"))}</strong>
                </span>
                <span className="rounded-lg bg-violet-50 px-3 py-1.5 text-violet-800 ring-1 ring-violet-200">
                  Inversiones <strong className="tabular-nums">{pesos(total("inversion"))}</strong>
                </span>
              </div>
            </div>
            {!esAdmin && <p className="text-xs text-slate-500">Usted ve los registros que hizo. El administrador ve todos.</p>}

            <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2 font-medium">Fecha</th>
                    <th className="px-4 py-2 font-medium">Descripción</th>
                    <th className="px-4 py-2 font-medium">Categoría</th>
                    <th className="px-4 py-2 font-medium">Pago</th>
                    <th className="px-4 py-2 text-right font-medium">Valor</th>
                    {esAdmin && <th className="px-4 py-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {gastos.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 whitespace-nowrap capitalize text-slate-600">{fecha(g.fecha)}</td>
                      <td className="px-4 py-2">
                        <span className="font-medium text-slate-900">{g.descripcion}</span>
                        {g.beneficiario && <span className="block text-xs text-slate-500">{g.beneficiario}</span>}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`mr-1 rounded px-1.5 py-0.5 text-xs font-semibold ${
                            g.tipo === "gasto" ? "bg-red-100 text-red-800" : "bg-violet-100 text-violet-800"
                          }`}
                        >
                          {TIPOS_GASTO[g.tipo]}
                        </span>
                        <span className="text-slate-600">{nombreCategoria(g.tipo, g.categoria)}</span>
                      </td>
                      <td className="px-4 py-2 text-slate-600">{FORMAS_PAGO_GASTO[g.forma_pago] ?? g.forma_pago}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-900">{pesos(g.valor)}</td>
                      {esAdmin && (
                        <td className="px-4 py-2 text-right">
                          <BotonBorrarGasto id={g.id} descripcion={g.descripcion} />
                        </td>
                      )}
                    </tr>
                  ))}
                  {gastos.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No hay gastos ni inversiones registrados en {nombreMes}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
