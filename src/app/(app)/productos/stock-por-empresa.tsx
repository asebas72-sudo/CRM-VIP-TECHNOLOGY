import { cantidad, pesos } from "@/lib/formato";
import { crearClienteServidor } from "@/lib/supabase/server";

type Fila = { codigo: string; nombre: string; precio: number; stock: Map<string, number> };

/**
 * Inventario consolidado: un producto por código y una columna de stock por
 * cada empresa a la que el usuario tiene acceso. Responde "¿dónde están?".
 */
export async function StockPorEmpresa({
  empresas,
  q,
}: {
  empresas: { id: string; nombre: string }[];
  q: string;
}) {
  const supabase = await crearClienteServidor();
  let consulta = supabase
    .from("productos")
    .select("empresa_id, codigo, nombre, precio_venta, stock")
    .in("empresa_id", empresas.map((e) => e.id))
    .eq("activo", true)
    .order("nombre")
    .limit(5000);
  if (q) {
    const limpio = q.replace(/[,()%*]/g, " ");
    consulta = consulta.or(`nombre.ilike.%${limpio}%,codigo.ilike.%${limpio}%,marca.ilike.%${limpio}%`);
  }
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);

  const filas = new Map<string, Fila>();
  for (const p of data ?? []) {
    const fila = filas.get(p.codigo) ?? { codigo: p.codigo, nombre: p.nombre, precio: Number(p.precio_venta), stock: new Map() };
    fila.stock.set(p.empresa_id, (fila.stock.get(p.empresa_id) ?? 0) + Number(p.stock));
    filas.set(p.codigo, fila);
  }
  const lista = [...filas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <div className="max-h-[calc(100vh-15rem)] overflow-auto rounded-2xl bg-white ring-1 ring-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 shadow-[inset_0_-1px_0_var(--color-slate-200)]">
          <tr>
            <th className="px-4 py-3 font-medium">Producto</th>
            {empresas.map((e) => (
              <th key={e.id} className="px-4 py-3 text-right font-medium">
                {e.nombre}
              </th>
            ))}
            <th className="px-4 py-3 text-right font-semibold text-slate-900">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lista.map((f) => {
            const total = [...f.stock.values()].reduce((s, n) => s + n, 0);
            return (
              <tr key={f.codigo} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <p className="font-medium text-slate-900">{f.nombre}</p>
                  <p className="font-mono text-xs text-slate-500">
                    {f.codigo} <span className="font-sans">· {pesos(f.precio)}</span>
                  </p>
                </td>
                {empresas.map((e) => {
                  const n = f.stock.get(e.id);
                  return (
                    <td
                      key={e.id}
                      className={`px-4 py-2 text-right tabular-nums ${
                        n === undefined ? "text-slate-300" : n > 0 ? "font-semibold text-slate-900" : "text-red-600"
                      }`}
                    >
                      {n === undefined ? "—" : cantidad(n)}
                    </td>
                  );
                })}
                <td className="px-4 py-2 text-right font-bold tabular-nums">{cantidad(total)}</td>
              </tr>
            );
          })}
          {lista.length === 0 && (
            <tr>
              <td colSpan={empresas.length + 2} className="px-4 py-8 text-center text-slate-500">
                No hay productos con ese criterio.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
