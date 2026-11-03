import Link from "next/link";
import { notFound } from "next/navigation";
import { CodigoQR } from "@/components/codigo-qr";
import { sesionActual } from "@/lib/empresa";
import { cantidad, pesos } from "@/lib/formato";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioAjuste, FormularioProducto, type ProductoEditable } from "./formularios";

const TIPOS: Record<string, { texto: string; signo: 1 | -1 }> = {
  entrada_compra: { texto: "Compra", signo: 1 },
  salida_venta: { texto: "Venta", signo: -1 },
  ajuste_entrada: { texto: "Ajuste +", signo: 1 },
  ajuste_salida: { texto: "Ajuste −", signo: -1 },
  anulacion_venta: { texto: "Venta anulada", signo: 1 },
};

type Movimiento = {
  id: string;
  tipo: string;
  cantidad: number;
  costo_unitario: number;
  nota: string | null;
  fecha: string;
  compras: { id: string; numero_factura: string } | null;
  ventas: { id: string; consecutivo: number } | null;
};

export default async function DetalleProducto({ params }: PageProps<"/productos/[id]">) {
  const { id } = await params;
  const { activa } = await sesionActual();
  if (!activa) notFound();
  const puedeEditar = activa.rol === "admin" || activa.rol === "bodega";
  const supabase = await crearClienteServidor();

  const [productoRes, categoriasRes, serialesRes, movimientosRes, empresaRes] = await Promise.all([
    supabase.from("productos").select("*, categorias (nombre)").eq("empresa_id", activa.id).eq("id", id).maybeSingle(),
    supabase.from("categorias").select("id, nombre").eq("empresa_id", activa.id).order("nombre"),
    supabase.from("seriales").select("id, serial").eq("producto_id", id).eq("estado", "disponible").order("serial"),
    supabase
      .from("movimientos_inventario")
      .select("id, tipo, cantidad, costo_unitario, nota, fecha, compras (id, numero_factura), ventas (id, consecutivo)")
      .eq("producto_id", id)
      .order("fecha", { ascending: false })
      .limit(100),
    supabase.from("empresas").select("margen_defecto").eq("id", activa.id).single(),
  ]);

  const p = productoRes.data;
  if (!p) notFound();
  const movimientos = (movimientosRes.data ?? []) as unknown as Movimiento[];
  const seriales = serialesRes.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/productos" className="text-sm text-blue-700 hover:underline">
          ← Productos
        </Link>
        <div className="mt-2 flex flex-wrap items-start gap-5">
          <div className="rounded-xl bg-white p-2 ring-1 ring-slate-200">
            <CodigoQR valor={p.codigo} tamano={96} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-slate-900">{p.nombre}</h1>
            <p className="font-mono text-sm text-slate-500">{p.codigo}</p>
            <div className="mt-3 flex flex-wrap gap-6">
              <Indicador titulo="Precio" valor={pesos(p.precio_venta)} />
              <Indicador
                titulo="Stock"
                valor={cantidad(p.stock)}
                alerta={p.stock <= 0 || (p.stock_minimo > 0 && p.stock <= p.stock_minimo)}
              />
              {puedeEditar && <Indicador titulo="Costo promedio" valor={pesos(p.costo_promedio)} />}
              {puedeEditar && <Indicador titulo="Último costo" valor={pesos(p.ultimo_costo)} />}
              {p.ubicacion && <Indicador titulo="Ubicación" valor={p.ubicacion} />}
            </div>
          </div>
        </div>
      </div>

      {puedeEditar && (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <FormularioProducto
            producto={p as ProductoEditable}
            categorias={categoriasRes.data ?? []}
            margenDefecto={Number(empresaRes.data?.margen_defecto ?? 30)}
          />
          <FormularioAjuste productoId={p.id} />
        </div>
      )}

      {p.maneja_serial && (
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="font-semibold text-slate-900">Seriales disponibles ({seriales.length})</h2>
          {seriales.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No hay seriales disponibles.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {seriales.map((s) => (
                <span key={s.id} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs">
                  {s.serial}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {puedeEditar && (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
          <h2 className="px-5 pt-4 font-semibold text-slate-900">Kardex (últimos 100 movimientos)</h2>
          <table className="mt-2 w-full text-left text-sm">
            <thead className="border-y border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Movimiento</th>
                <th className="px-4 py-2 font-medium">Documento</th>
                <th className="px-4 py-2 text-right font-medium">Cantidad</th>
                <th className="px-4 py-2 text-right font-medium">Costo u.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movimientos.map((m) => {
                const tipo = TIPOS[m.tipo] ?? { texto: m.tipo, signo: 1 };
                return (
                  <tr key={m.id}>
                    <td className="px-4 py-2 text-slate-600">{new Date(m.fecha).toLocaleString("es-CO")}</td>
                    <td className="px-4 py-2">{tipo.texto}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {m.compras ? (
                        <Link href={`/compras/${m.compras.id}`} className="text-blue-700 hover:underline">
                          Factura {m.compras.numero_factura}
                        </Link>
                      ) : m.ventas ? (
                        <Link href={`/ventas/${m.ventas.id}`} className="text-blue-700 hover:underline">
                          Venta #{m.ventas.consecutivo}
                        </Link>
                      ) : (
                        m.nota
                      )}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-medium tabular-nums ${
                        tipo.signo > 0 ? "text-green-700" : "text-red-600"
                      }`}
                    >
                      {tipo.signo > 0 ? "+" : "−"}
                      {cantidad(m.cantidad)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-600">{pesos(m.costo_unitario)}</td>
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

function Indicador({ titulo, valor, alerta }: { titulo: string; valor: string; alerta?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`text-lg font-semibold ${alerta ? "text-red-600" : "text-slate-900"}`}>{valor}</p>
    </div>
  );
}
