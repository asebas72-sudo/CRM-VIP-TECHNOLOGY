import Link from "next/link";
import { exigirRol } from "@/lib/empresa";
import { fecha, pesos } from "@/lib/formato";
import { crearClienteServidor } from "@/lib/supabase/server";

export default async function PaginaCompras() {
  const { activa } = await exigirRol("admin", "bodega");
  const supabase = await crearClienteServidor();

  const { data, error } = await supabase
    .from("compras")
    .select("id, numero_factura, fecha, total, proveedores (nombre), compra_items (count)")
    .eq("empresa_id", activa.id)
    .order("fecha", { ascending: false })
    .order("creado_en", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Compras</h1>
          <p className="text-sm text-slate-500">Facturas de proveedores cargadas al inventario.</p>
        </div>
        <Link
          href="/compras/importar"
          className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
        >
          Importar factura XML
        </Link>
      </div>

      {(data ?? []).length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-slate-500 ring-1 ring-slate-200">
          Aún no hay compras. Importe la primera factura XML.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Factura</th>
                <th className="px-4 py-3 font-medium">Proveedor</th>
                <th className="px-4 py-3 text-right font-medium">Líneas</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data ?? []).map((c) => {
                const proveedor = Array.isArray(c.proveedores) ? c.proveedores[0] : c.proveedores;
                const lineas = (c.compra_items as unknown as { count: number }[])[0]?.count ?? 0;
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{fecha(c.fecha)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/compras/${c.id}`} className="font-medium text-blue-700 hover:underline">
                        {c.numero_factura}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-900">{proveedor?.nombre}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{lineas}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{pesos(c.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
