import { empresaActiva } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";
import { CrearEmpresa } from "./crear-empresa";

export default async function Inicio() {
  const { activa } = await empresaActiva();
  if (!activa) return <CrearEmpresa />;

  const supabase = await crearClienteServidor();
  const [productos, bajoStock] = await Promise.all([
    supabase.from("productos").select("id", { count: "exact", head: true }).eq("empresa_id", activa.id),
    supabase
      .from("productos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", activa.id)
      .lte("stock", 0),
  ]);

  const tarjetas = [
    { titulo: "Productos", valor: productos.count ?? 0 },
    { titulo: "Sin existencias", valor: bajoStock.count ?? 0 },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">{activa.nombre}</h1>
      <p className="text-sm text-slate-500">Rol: {activa.rol}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map((t) => (
          <div key={t.titulo} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">{t.titulo}</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{t.valor}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
