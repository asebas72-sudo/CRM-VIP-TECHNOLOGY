import { exigirRol, type Perfil } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cambiarAccesoTotal, cambiarActivo } from "./acciones";
import { CampoCelular, FormularioAgregar, SelectorRol } from "./componentes";

export default async function PaginaUsuarios() {
  const { perfil: yo, todas } = await exigirRol("admin");
  const empresas = todas.filter((e) => e.rol === "admin");
  const supabase = await crearClienteServidor();

  const [perfilesRes, miembrosRes] = await Promise.all([
    supabase.from("perfiles").select("usuario_id, nombre, correo, acceso_total, activo, celular").order("nombre"),
    supabase
      .from("miembros_empresa")
      .select("usuario_id, empresa_id, rol")
      .in("empresa_id", empresas.map((e) => e.id)),
  ]);
  if (perfilesRes.error) throw new Error(perfilesRes.error.message);

  const perfiles = (perfilesRes.data ?? []) as (Perfil & { celular: string | null })[];
  const rolDe = new Map(
    (miembrosRes.data ?? []).map((m) => [`${m.usuario_id}:${m.empresa_id}`, m.rol as string]),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Usuarios</h1>
        <p className="text-sm text-slate-500">
          Asigne a cada usuario las empresas a las que puede entrar y su rol en cada una.
          {yo.acceso_total && " Los usuarios con acceso total ven todas las empresas, incluso las nuevas."}
        </p>
      </div>

      <FormularioAgregar empresas={empresas} />

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Usuario</th>
              {yo.acceso_total && <th className="px-4 py-3 font-medium">Acceso total</th>}
              {empresas.map((e) => (
                <th key={e.id} className="px-4 py-3 font-medium">
                  {e.nombre}
                </th>
              ))}
              {yo.acceso_total && <th className="px-4 py-3 font-medium">Estado</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {perfiles.map((p) => {
              const soyYo = p.usuario_id === yo.usuario_id;
              return (
                <tr key={p.usuario_id} className={p.activo ? "" : "opacity-50"}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">
                      {p.nombre ?? "—"} {soyYo && <span className="text-xs text-slate-400">(usted)</span>}
                    </p>
                    <p className="text-slate-500">{p.correo}</p>
                    <CampoCelular usuarioId={p.usuario_id} celular={p.celular} />
                  </td>
                  {yo.acceso_total && (
                    <td className="px-4 py-3">
                      <form action={cambiarAccesoTotal}>
                        <input type="hidden" name="usuario_id" value={p.usuario_id} />
                        <input type="hidden" name="valor" value={String(!p.acceso_total)} />
                        <button
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            p.acceso_total ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {p.acceso_total ? "Sí" : "No"}
                        </button>
                      </form>
                    </td>
                  )}
                  {empresas.map((e) => (
                    <td key={e.id} className="px-4 py-3">
                      {p.acceso_total ? (
                        <span className="text-xs text-slate-500">Administrador (total)</span>
                      ) : (
                        <SelectorRol
                          usuarioId={p.usuario_id}
                          correo={p.correo}
                          empresaId={e.id}
                          rol={rolDe.get(`${p.usuario_id}:${e.id}`) ?? ""}
                          deshabilitado={soyYo}
                        />
                      )}
                    </td>
                  ))}
                  {yo.acceso_total && (
                    <td className="px-4 py-3">
                      {soyYo ? (
                        <span className="text-xs text-slate-500">Activo</span>
                      ) : (
                        <form action={cambiarActivo}>
                          <input type="hidden" name="usuario_id" value={p.usuario_id} />
                          <input type="hidden" name="valor" value={String(!p.activo)} />
                          <button className="text-xs font-medium text-blue-700 hover:underline">
                            {p.activo ? "Desactivar" : "Activar"}
                          </button>
                        </form>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
