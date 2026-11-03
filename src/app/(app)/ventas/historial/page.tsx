import Link from "next/link";
import { exigirRol } from "@/lib/empresa";
import { pesos } from "@/lib/formato";
import { crearClienteServidor } from "@/lib/supabase/server";

const FORMA: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  mixto: "Mixto",
};

/** Fecha de hoy en Colombia (AAAA-MM-DD) */
function hoyColombia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

type Venta = {
  id: string;
  consecutivo: number;
  fecha: string;
  subtotal: number;
  total: number;
  forma_pago: string;
  tipo: string;
  saldo: number;
  estado: string;
  clientes: { nombre: string } | null;
  venta_items: { cantidad: number; costo_unitario: number }[];
};

export default async function HistorialVentas({ searchParams }: PageProps<"/ventas/historial">) {
  const { activa } = await exigirRol("admin", "vendedor");
  const p = await searchParams;
  const desde = typeof p.desde === "string" && p.desde ? p.desde : hoyColombia();
  const hasta = typeof p.hasta === "string" && p.hasta ? p.hasta : desde;
  const esAdmin = activa.rol === "admin";

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("ventas")
    .select("id, consecutivo, fecha, subtotal, total, forma_pago, tipo, saldo, estado, clientes (nombre), venta_items (cantidad, costo_unitario)")
    .eq("empresa_id", activa.id)
    .gte("fecha", `${desde}T00:00:00-05:00`)
    .lte("fecha", `${hasta}T23:59:59.999-05:00`)
    .order("consecutivo", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  const ventas = (data ?? []) as unknown as Venta[];

  const pagadas = ventas.filter((v) => v.estado === "pagada");
  const total = pagadas.reduce((s, v) => s + Number(v.total), 0);
  const sinIva = pagadas.reduce((s, v) => s + Number(v.subtotal), 0);
  const costo = pagadas.reduce(
    (s, v) => s + v.venta_items.reduce((t, i) => t + Number(i.cantidad) * Number(i.costo_unitario), 0),
    0,
  );
  const porForma = Object.entries(
    pagadas.filter((v) => v.tipo === "contado").reduce<Record<string, number>>((acc, v) => {
      acc[v.forma_pago] = (acc[v.forma_pago] ?? 0) + Number(v.total);
      return acc;
    }, {}),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/ventas" className="text-sm text-blue-700 hover:underline">
            ← Vender
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Historial de ventas</h1>
        </div>
        <form className="flex flex-wrap items-end gap-2 text-sm">
          <label className="text-slate-600">
            Desde
            <input type="date" name="desde" defaultValue={desde} className="ml-1 rounded-lg border border-slate-300 px-2 py-1.5" />
          </label>
          <label className="text-slate-600">
            Hasta
            <input type="date" name="hasta" defaultValue={hasta} className="ml-1 rounded-lg border border-slate-300 px-2 py-1.5" />
          </label>
          <button className="rounded-lg bg-slate-900 px-3 py-1.5 font-semibold text-white">Ver</button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta titulo="Total vendido" valor={pesos(total)} detalle={`${pagadas.length} venta(s)`} />
        {esAdmin && (
          <Tarjeta
            titulo="Utilidad bruta"
            valor={pesos(sinIva - costo)}
            detalle="Ventas sin IVA menos costo promedio"
          />
        )}
        {porForma.map(([forma, valor]) => (
          <Tarjeta key={forma} titulo={FORMA[forma] ?? forma} valor={pesos(valor)} />
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">No.</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Tipo / pago</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ventas.map((v) => (
              <tr key={v.id} className={v.estado === "anulada" ? "text-slate-400 line-through" : "hover:bg-slate-50"}>
                <td className="px-4 py-2">
                  <Link href={`/ventas/${v.id}`} className="font-semibold text-blue-700 hover:underline">
                    #{v.consecutivo}
                  </Link>
                </td>
                <td className="px-4 py-2">{new Date(v.fecha).toLocaleString("es-CO")}</td>
                <td className="px-4 py-2">{v.clientes?.nombre ?? "—"}</td>
                <td className="px-4 py-2">
                  {v.tipo === "contado" ? (FORMA[v.forma_pago] ?? v.forma_pago) : v.tipo === "credito" ? "Crédito" : "Separado"}
                  {v.saldo > 0 && <span className="ml-2 text-xs font-semibold text-red-600">debe {pesos(v.saldo)}</span>}
                </td>
                <td className="px-4 py-2 text-right font-medium tabular-nums">{pesos(v.total)}</td>
              </tr>
            ))}
            {ventas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No hay ventas en este periodo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tarjeta({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <p className="text-sm text-slate-500">{titulo}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{valor}</p>
      {detalle && <p className="text-xs text-slate-500">{detalle}</p>}
    </div>
  );
}
