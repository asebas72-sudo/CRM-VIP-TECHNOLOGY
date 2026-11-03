import Link from "next/link";
import { NOMBRE_ROL, sesionActual } from "@/lib/empresa";
import { cantidad, pesos } from "@/lib/formato";
import { crearClienteServidor } from "@/lib/supabase/server";
import { CrearEmpresa } from "./crear-empresa";

export default async function Inicio() {
  const { perfil, activa } = await sesionActual();

  if (!activa) {
    if (perfil.acceso_total) return <CrearEmpresa />;
    return (
      <div className="mx-auto mt-10 max-w-md rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Su cuenta aún no tiene acceso</h2>
        <p className="mt-2 text-sm text-slate-500">
          {perfil.activo
            ? `Pida a un administrador que le asigne una empresa usando su correo ${perfil.correo}.`
            : "Su usuario está desactivado. Comuníquese con un administrador."}
        </p>
      </div>
    );
  }

  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const supabase = await crearClienteServidor();
  const [ventasRes, productosRes] = await Promise.all([
    supabase
      .from("ventas")
      .select("total")
      .eq("empresa_id", activa.id)
      .eq("estado", "pagada")
      .gte("fecha", `${hoy}T00:00:00-05:00`),
    supabase
      .from("productos")
      .select("id, nombre, codigo, stock, stock_minimo, costo_promedio")
      .eq("empresa_id", activa.id)
      .eq("activo", true),
  ]);

  const ventasHoy = ventasRes.data ?? [];
  const productos = productosRes.data ?? [];
  const alertas = productos
    .filter((p) => p.stock <= 0 || (p.stock_minimo > 0 && p.stock <= p.stock_minimo))
    .sort((a, b) => a.stock - b.stock);
  const verCostos = activa.rol !== "vendedor";

  const tarjetas = [
    { titulo: "Ventas de hoy", valor: pesos(ventasHoy.reduce((s, v) => s + Number(v.total), 0)), detalle: `${ventasHoy.length} venta(s)` },
    { titulo: "Productos activos", valor: String(productos.length) },
    {
      titulo: "Unidades en inventario",
      valor: cantidad(productos.reduce((s, p) => s + Math.max(Number(p.stock), 0), 0)),
      detalle: verCostos
        ? `Al costo ${pesos(productos.reduce((s, p) => s + Math.max(Number(p.stock), 0) * Number(p.costo_promedio), 0))}`
        : undefined,
    },
    { titulo: "Alertas de stock", valor: String(alertas.length), detalle: "Sin existencias o bajo mínimo" },
  ];

  const accesos = [
    { href: "/ventas", texto: "Vender", roles: ["admin", "vendedor"] },
    { href: "/compras/importar", texto: "Importar factura", roles: ["admin", "bodega"] },
    { href: "/productos?filtro=sin-precio", texto: "Revisar precios", roles: ["admin", "bodega"] },
    { href: "/etiquetas", texto: "Imprimir etiquetas", roles: ["admin", "bodega"] },
  ].filter((a) => a.roles.includes(activa.rol));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{activa.nombre}</h1>
        <p className="text-sm text-slate-500">{perfil.acceso_total ? "Acceso total" : NOMBRE_ROL[activa.rol]}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map((t) => (
          <div key={t.titulo} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">{t.titulo}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{t.valor}</p>
            {t.detalle && <p className="text-xs text-slate-500">{t.detalle}</p>}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {accesos.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            {a.texto}
          </Link>
        ))}
      </div>

      {alertas.length > 0 && (
        <div className="rounded-2xl bg-white ring-1 ring-slate-200">
          <h2 className="px-5 pt-4 font-semibold text-slate-900">Productos para reponer</h2>
          <ul className="mt-2 divide-y divide-slate-100">
            {alertas.slice(0, 15).map((p) => (
              <li key={p.id} className="flex items-center justify-between px-5 py-2 text-sm">
                <Link href={`/productos/${p.id}`} className="text-slate-900 hover:text-blue-700">
                  {p.nombre} <span className="font-mono text-xs text-slate-500">{p.codigo}</span>
                </Link>
                <span className="font-semibold tabular-nums text-red-600">
                  {cantidad(p.stock)}
                  {p.stock_minimo > 0 && <span className="font-normal text-slate-400"> / mín. {p.stock_minimo}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
