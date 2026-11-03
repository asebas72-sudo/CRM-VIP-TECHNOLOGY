import { NOMBRE_ROL, sesionActual } from "@/lib/empresa";
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

  const supabase = await crearClienteServidor();
  const [productos, sinStock] = await Promise.all([
    supabase.from("productos").select("id", { count: "exact", head: true }).eq("empresa_id", activa.id),
    supabase
      .from("productos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", activa.id)
      .lte("stock", 0),
  ]);

  const tarjetas = [
    { titulo: "Productos", valor: productos.count ?? 0 },
    { titulo: "Sin existencias", valor: sinStock.count ?? 0 },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">{activa.nombre}</h1>
      <p className="text-sm text-slate-500">
        {perfil.acceso_total ? "Acceso total" : NOMBRE_ROL[activa.rol]}
      </p>
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
