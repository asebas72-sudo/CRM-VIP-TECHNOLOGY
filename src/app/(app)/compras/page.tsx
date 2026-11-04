import Link from "next/link";
import { ValorCopiable } from "@/components/copiar";
import { exigirRol } from "@/lib/empresa";
import { cantidad, fecha, pesos } from "@/lib/formato";
import { crearClienteServidor } from "@/lib/supabase/server";

type Compra = {
  id: string;
  numero_factura: string;
  cufe: string | null;
  origen: string;
  fecha: string;
  total: number;
  proveedores: { nombre: string } | null;
  compra_items: {
    id: string;
    descripcion: string;
    cantidad: number;
    costo_unitario: number;
    total: number;
    productos: { codigo: string; nombre: string } | null;
  }[];
};

export default async function PaginaCompras() {
  const { activa } = await exigirRol("admin", "bodega");
  const supabase = await crearClienteServidor();

  const { data, error } = await supabase
    .from("compras")
    .select(
      "id, numero_factura, cufe, fecha, total, origen, proveedores (nombre)," +
        " compra_items (id, descripcion, cantidad, costo_unitario, total, productos (codigo, nombre))",
    )
    .eq("empresa_id", activa.id)
    .order("fecha", { ascending: false })
    .order("creado_en", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const compras = (data ?? []) as unknown as Compra[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Compras</h1>
          <p className="text-sm text-slate-500">
            Facturas de proveedores cargadas a <strong>{activa.nombre}</strong>. Clic en una factura para ver sus líneas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/compras/consultar"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Consultar compras
          </Link>
          <Link
            href="/compras/foto"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Desde foto o manual
          </Link>
          <Link
            href="/compras/importar"
            className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
          >
            Importar factura XML
          </Link>
        </div>
      </div>

      {compras.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-slate-500 ring-1 ring-slate-200">
          Aún no hay compras. Importe la primera factura XML.
        </p>
      ) : (
        <div className="space-y-2">
          {compras.map((c) => {
            const unidades = c.compra_items.reduce((s, i) => s + Number(i.cantidad), 0);
            return (
              <details key={c.id} className="group rounded-2xl bg-white ring-1 ring-slate-200">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 hover:bg-slate-50">
                  <span className="text-slate-400 transition group-open:rotate-90">▶</span>
                  <span className="w-24 text-sm text-slate-600">{fecha(c.fecha)}</span>
                  <span className="w-28 font-semibold text-slate-900">{c.numero_factura}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {c.origen === "xml" ? "XML" : c.origen === "foto" ? "Foto" : "Manual"}
                  </span>
                  <span className="min-w-40 flex-1 text-slate-700">{c.proveedores?.nombre}</span>
                  <span className="text-sm text-slate-500">
                    {c.compra_items.length} líneas · {cantidad(unidades)} und.
                  </span>
                  <span className="w-32 text-right font-semibold tabular-nums">{pesos(c.total)}</span>
                </summary>
                <div className="border-t border-slate-100 px-4 pb-4">
                  {c.cufe && (
                    <div className="mt-3">
                      <ValorCopiable etiqueta="CUFE" valor={c.cufe} />
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="mt-2 w-full text-left text-sm">
                      <thead className="text-slate-500">
                        <tr>
                          <th className="py-2 pr-3 font-medium">Código</th>
                          <th className="py-2 pr-3 font-medium">Producto</th>
                          <th className="py-2 pr-3 text-right font-medium">Cant.</th>
                          <th className="py-2 pr-3 text-right font-medium">Costo u.</th>
                          <th className="py-2 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {c.compra_items.map((i) => (
                          <tr key={i.id}>
                            <td className="py-1.5 pr-3 font-mono text-xs text-slate-600">{i.productos?.codigo}</td>
                            <td className="py-1.5 pr-3 text-slate-900">{i.productos?.nombre ?? i.descripcion}</td>
                            <td className="py-1.5 pr-3 text-right tabular-nums">{cantidad(i.cantidad)}</td>
                            <td className="py-1.5 pr-3 text-right tabular-nums">{pesos(i.costo_unitario)}</td>
                            <td className="py-1.5 text-right tabular-nums">{pesos(i.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Link href={`/compras/${c.id}`} className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline">
                    Ver detalle completo (seriales, XML, PDF) →
                  </Link>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
