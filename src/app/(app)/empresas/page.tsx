import { redirect } from "next/navigation";
import { sesionActual } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";
import { actualizarEmpresa } from "../acciones";
import { CrearEmpresa } from "../crear-empresa";

export default async function PaginaEmpresas() {
  const { perfil } = await sesionActual();
  if (!perfil.acceso_total) redirect("/");

  const supabase = await crearClienteServidor();
  const [empresasRes, miembrosRes] = await Promise.all([
    supabase.from("empresas").select("id, nombre, nit, creado_en").order("nombre"),
    supabase.from("miembros_empresa").select("empresa_id"),
  ]);
  if (empresasRes.error) throw new Error(empresasRes.error.message);

  const usuariosPorEmpresa = new Map<string, number>();
  for (const m of miembrosRes.data ?? []) {
    usuariosPorEmpresa.set(m.empresa_id, (usuariosPorEmpresa.get(m.empresa_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Empresas</h1>
        <p className="text-sm text-slate-500">Solo el superadmin ve esta sección.</p>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium" colSpan={2}>
                Empresa y NIT
              </th>
              <th className="px-4 py-3 font-medium">Usuarios asignados</th>
              <th className="px-4 py-3 font-medium">Creada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(empresasRes.data ?? []).map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3" colSpan={2}>
                  <form action={actualizarEmpresa} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={e.id} />
                    <input
                      name="nombre"
                      defaultValue={e.nombre}
                      required
                      aria-label="Nombre de la empresa"
                      className="min-w-48 flex-1 rounded-md border border-slate-300 px-2 py-1 font-medium text-slate-900"
                    />
                    <input
                      name="nit"
                      defaultValue={e.nit ?? ""}
                      placeholder="NIT"
                      aria-label="NIT"
                      className="w-56 rounded-md border border-slate-300 px-2 py-1 text-slate-700"
                    />
                    <button className="rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-700">
                      Guardar
                    </button>
                  </form>
                </td>
                <td className="px-4 py-3 text-slate-600">{usuariosPorEmpresa.get(e.id) ?? 0}</td>
                <td className="px-4 py-3 text-slate-600">
                  {new Date(e.creado_en).toLocaleDateString("es-CO")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CrearEmpresa titulo="Nueva empresa" />
    </div>
  );
}
