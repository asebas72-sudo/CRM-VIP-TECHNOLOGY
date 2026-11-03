import Link from "next/link";
import { sesionActual } from "@/lib/empresa";
import { cantidad, pesos } from "@/lib/formato";
import { crearClienteServidor } from "@/lib/supabase/server";
import { margen } from "@/lib/precios";
import { EditorPrecio } from "./precio";
import { StockPorEmpresa } from "./stock-por-empresa";

type Producto = {
  id: string;
  codigo: string;
  nombre: string;
  marca: string | null;
  stock: number;
  stock_minimo: number;
  costo_promedio: number;
  precio_venta: number;
  iva_porcentaje: number;
  ubicacion: string | null;
  activo: boolean;
  categorias: { nombre: string } | null;
};

const FILTROS = [
  { valor: "", texto: "Todos" },
  { valor: "sin-stock", texto: "Sin existencias" },
  { valor: "bajo-minimo", texto: "Bajo mínimo" },
  { valor: "sin-precio", texto: "Revisar precio" },
  { valor: "inactivos", texto: "Inactivos" },
];

export default async function PaginaProductos({ searchParams }: PageProps<"/productos">) {
  const { activa, todas } = await sesionActual();
  if (!activa) return null;
  const parametros = await searchParams;
  const q = String(parametros.q ?? "").trim();
  const filtro = String(parametros.filtro ?? "");
  const vistaTodas = parametros.vista === "todas" && todas.length > 1;
  const puedeEditar = activa.rol === "admin" || activa.rol === "bodega";

  const pestanas =
    todas.length > 1 ? (
      <div className="flex gap-1 rounded-lg bg-slate-200 p-1 text-sm">
        <Link
          href={`/productos${q ? `?q=${encodeURIComponent(q)}` : ""}`}
          className={`rounded-md px-3 py-1.5 font-semibold ${vistaTodas ? "text-slate-600" : "bg-white text-slate-900 shadow-sm"}`}
        >
          {activa.nombre}
        </Link>
        <Link
          href={`/productos?vista=todas${q ? `&q=${encodeURIComponent(q)}` : ""}`}
          className={`rounded-md px-3 py-1.5 font-semibold ${vistaTodas ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
        >
          Stock en todas las empresas
        </Link>
      </div>
    ) : null;

  if (vistaTodas) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Productos</h1>
            <p className="text-sm text-slate-500">Existencias de cada producto (por código) en cada empresa.</p>
          </div>
          {pestanas}
        </div>
        <form className="flex flex-wrap gap-2">
          <input type="hidden" name="vista" value="todas" />
          <input
            name="q"
            defaultValue={q}
            autoFocus
            placeholder="Buscar o escanear código..."
            className="min-w-64 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2"
          />
          <button className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">Buscar</button>
        </form>
        <StockPorEmpresa empresas={todas.map((e) => ({ id: e.id, nombre: e.nombre }))} q={q} />
      </div>
    );
  }

  const supabase = await crearClienteServidor();
  let consulta = supabase
    .from("productos")
    .select(
      "id, codigo, nombre, marca, stock, stock_minimo, costo_promedio, precio_venta, iva_porcentaje, ubicacion, activo, categorias (nombre)",
    )
    .eq("empresa_id", activa.id)
    .eq("activo", filtro !== "inactivos")
    .order("nombre")
    .limit(500);

  if (q) {
    const limpio = q.replace(/[,()%*]/g, " ");
    consulta = consulta.or(`nombre.ilike.%${limpio}%,codigo.ilike.%${limpio}%,marca.ilike.%${limpio}%`);
  }
  if (filtro === "sin-stock") consulta = consulta.lte("stock", 0);

  const { data, error } = await consulta;
  if (error) throw new Error(error.message);

  let productos = (data ?? []) as unknown as Producto[];
  if (filtro === "bajo-minimo") productos = productos.filter((p) => p.stock_minimo > 0 && p.stock <= p.stock_minimo);
  if (filtro === "sin-precio") {
    productos = productos.filter((p) => {
      const m = margen(p.precio_venta, p.costo_promedio, p.iva_porcentaje);
      return p.precio_venta <= 0 || (m !== null && m < 10);
    });
  }

  const valorInventario = productos.reduce((s, p) => s + Math.max(p.stock, 0) * p.costo_promedio, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
        <h1 className="text-2xl font-bold text-slate-900">Productos de {activa.nombre}</h1>
        <p className="text-sm text-slate-500">
          {productos.length} producto(s)
          {puedeEditar && ` · inventario al costo ${pesos(valorInventario)}`}
          {puedeEditar && " · edite el precio y presione Guardar o Enter"}
        </p>
        </div>
        {pestanas}
      </div>

      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="Buscar o escanear código..."
          className="min-w-64 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2"
        />
        <select name="filtro" defaultValue={filtro} className="rounded-lg border border-slate-300 bg-white px-3 py-2">
          {FILTROS.map((f) => (
            <option key={f.valor} value={f.valor}>
              {f.texto}
            </option>
          ))}
        </select>
        <button className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">Buscar</button>
      </form>

      <div className="max-h-[calc(100vh-15rem)] overflow-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 shadow-[inset_0_-1px_0_var(--color-slate-200)]">
            <tr>
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 text-right font-medium">Stock</th>
              {puedeEditar && <th className="px-4 py-3 text-right font-medium">Costo prom.</th>}
              <th className="px-4 py-3 text-right font-medium">
                {puedeEditar ? "Margen · Precio venta (IVA incl.)" : "Precio"}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {productos.map((p) => {
              const bajo = p.stock <= 0 || (p.stock_minimo > 0 && p.stock <= p.stock_minimo);
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/productos/${p.id}`} className="font-medium text-slate-900 hover:text-blue-700">
                      {p.nombre}
                    </Link>
                    <p className="font-mono text-xs text-slate-500">
                      {p.codigo}
                      {p.marca && <span className="font-sans"> · {p.marca}</span>}
                      {p.ubicacion && <span className="font-sans"> · {p.ubicacion}</span>}
                    </p>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{p.categorias?.nombre ?? "—"}</td>
                  <td className={`px-4 py-2 text-right tabular-nums ${bajo ? "font-semibold text-red-600" : ""}`}>
                    {cantidad(p.stock)}
                  </td>
                  {puedeEditar && (
                    <td className="px-4 py-2 text-right tabular-nums text-slate-600">{pesos(p.costo_promedio)}</td>
                  )}
                  <td className="px-4 py-2 text-right">
                    {puedeEditar ? (
                      <EditorPrecio
                        productoId={p.id}
                        precio={Number(p.precio_venta)}
                        costo={Number(p.costo_promedio)}
                        iva={Number(p.iva_porcentaje)}
                      />
                    ) : (
                      <span className="font-semibold tabular-nums">{pesos(p.precio_venta)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {productos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No hay productos con ese criterio.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
