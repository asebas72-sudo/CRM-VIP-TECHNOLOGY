import Link from "next/link";
import { exigirRol } from "@/lib/empresa";
import { fecha, pesos } from "@/lib/formato";
import { crearClienteServidor } from "@/lib/supabase/server";
import { BotonAbonar, BotonEntregar } from "../ventas/abono";

type Venta = {
  id: string;
  consecutivo: number;
  fecha: string;
  tipo: "credito" | "separado" | "contado";
  total: number;
  abonado: number;
  saldo: number;
  fecha_vencimiento: string | null;
  entregada: boolean;
  clientes: { nombre: string; documento: string | null; telefono: string | null } | null;
};

const TIPO: Record<string, string> = { credito: "Crédito", separado: "Separado", contado: "Contado" };

export default async function PaginaCartera({ searchParams }: PageProps<"/cartera">) {
  const { activa } = await exigirRol("admin", "vendedor");
  const { q } = await searchParams;
  const busqueda = typeof q === "string" ? q.trim().toLowerCase() : "";
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("ventas")
    .select(
      "id, consecutivo, fecha, tipo, total, abonado, saldo, fecha_vencimiento, entregada, clientes (nombre, documento, telefono)",
    )
    .eq("empresa_id", activa.id)
    .eq("estado", "pagada")
    .or("saldo.gt.0,entregada.eq.false")
    .order("fecha_vencimiento", { ascending: true, nullsFirst: false })
    .limit(1000);
  if (error) throw new Error(error.message);

  let ventas = (data ?? []) as unknown as Venta[];
  if (busqueda) {
    ventas = ventas.filter(
      (v) =>
        v.clientes?.nombre.toLowerCase().includes(busqueda) ||
        (v.clientes?.documento ?? "").includes(busqueda) ||
        String(v.consecutivo) === busqueda,
    );
  }

  const pendientes = ventas.filter((v) => v.saldo > 0);
  const totalCartera = pendientes.reduce((s, v) => s + Number(v.saldo), 0);
  const vencidas = pendientes.filter((v) => v.fecha_vencimiento && v.fecha_vencimiento < hoy);
  const totalVencido = vencidas.reduce((s, v) => s + Number(v.saldo), 0);
  const porEntregar = ventas.filter((v) => v.saldo <= 0 && !v.entregada);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cartera y abonos</h1>
        <p className="text-sm text-slate-500">Ventas a crédito y separados con saldo pendiente en {activa.nombre}.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Tarjeta titulo="Por cobrar" valor={pesos(totalCartera)} detalle={`${pendientes.length} venta(s)`} />
        <Tarjeta titulo="Vencido" valor={pesos(totalVencido)} detalle={`${vencidas.length} venta(s)`} alerta={totalVencido > 0} />
        <Tarjeta titulo="Separados listos para entregar" valor={String(porEntregar.length)} />
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={busqueda}
          placeholder="Buscar por cliente, cédula o número de venta..."
          className="min-w-64 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2"
        />
        <button className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">Buscar</button>
      </form>

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Venta</th>
              <th className="px-4 py-3 font-medium">Vence</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 text-right font-medium">Abonado</th>
              <th className="px-4 py-3 text-right font-medium">Saldo</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ventas.map((v) => {
              const vencida = v.saldo > 0 && v.fecha_vencimiento && v.fecha_vencimiento < hoy;
              return (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <p className="font-medium text-slate-900">{v.clientes?.nombre}</p>
                    <p className="text-xs text-slate-500">
                      {[v.clientes?.documento, v.clientes?.telefono].filter(Boolean).join(" · ")}
                    </p>
                  </td>
                  <td className="px-4 py-2">
                    <Link href={`/ventas/${v.id}`} className="font-semibold text-blue-700 hover:underline">
                      #{v.consecutivo}
                    </Link>
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{TIPO[v.tipo]}</span>
                    <p className="text-xs text-slate-500">{fecha(v.fecha)}</p>
                  </td>
                  <td className={`px-4 py-2 ${vencida ? "font-semibold text-red-600" : "text-slate-600"}`}>
                    {v.fecha_vencimiento ? fecha(v.fecha_vencimiento) : "—"}
                    {vencida && <span className="block text-xs">Vencida</span>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{pesos(v.total)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-green-700">{pesos(v.abonado)}</td>
                  <td className="px-4 py-2 text-right font-bold tabular-nums text-red-600">{pesos(v.saldo)}</td>
                  <td className="px-4 py-2 text-right">
                    {v.saldo > 0 ? (
                      <BotonAbonar
                        ventaId={v.id}
                        consecutivo={v.consecutivo}
                        cliente={v.clientes?.nombre ?? ""}
                        saldo={Number(v.saldo)}
                        compacto
                      />
                    ) : (
                      <BotonEntregar ventaId={v.id} compacto />
                    )}
                  </td>
                </tr>
              );
            })}
            {ventas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No hay saldos pendientes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tarjeta({ titulo, valor, detalle, alerta }: { titulo: string; valor: string; detalle?: string; alerta?: boolean }) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <p className="text-sm text-slate-500">{titulo}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${alerta ? "text-red-600" : "text-slate-900"}`}>{valor}</p>
      {detalle && <p className="text-xs text-slate-500">{detalle}</p>}
    </div>
  );
}
