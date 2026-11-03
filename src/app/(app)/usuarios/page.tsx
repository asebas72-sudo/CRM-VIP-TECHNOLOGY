import { redirect } from "next/navigation";
import { sesionActual, type Perfil } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cambiarAccesoTotal, cambiarActivo } from "./acciones";
import { CampoCelular, EliminarUsuario, FormularioAgregar, RestablecerClave, SelectorRol } from "./componentes";

/** Gestión de usuarios: exclusiva del superadmin. */
export default async function PaginaUsuarios() {
  const { perfil: yo, todas } = await sesionActual();
  if (!yo.acceso_total) redirect("/");
  const empresas = todas;
  const supabase = await crearClienteServidor();

  const [perfilesRes, miembrosRes] = await Promise.all([
    supabase.from("perfiles").select("usuario_id, nombre, correo, acceso_total, activo, celular, creado_en").order("creado_en", { ascending: false }),
    supabase
      .from("miembros_empresa")
      .select("usuario_id, empresa_id, rol")
      .in("empresa_id", empresas.map((e) => e.id)),
  ]);
  if (perfilesRes.error) throw new Error(perfilesRes.error.message);

  const perfiles = (perfilesRes.data ?? []) as (Perfil & { celular: string | null })[];
  const rolDe = new Map((miembrosRes.data ?? []).map((m) => [`${m.usuario_id}:${m.empresa_id}`, m.rol as string]));
  const conAcceso = new Set((miembrosRes.data ?? []).map((m) => m.usuario_id));
  const nuevos = perfiles.filter((p) => !p.acceso_total && p.activo && !conAcceso.has(p.usuario_id)).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Configuración</p>
        <h1 className="text-2xl font-bold text-slate-900">Usuarios</h1>
        <p className="text-sm text-slate-500">
          Solo el superadmin crea, inactiva o elimina usuarios y define a qué empresas entra cada uno y con qué rol. El
          superadmin ve todas las empresas, incluso las nuevas.
        </p>
      </div>

      {nuevos > 0 && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          ⚠ Hay <strong>{nuevos}</strong> usuario(s) sin empresa asignada. Están marcados como{" "}
          <strong>Nuevo</strong> en la tabla.
        </p>
      )}

      <FormularioAgregar empresas={empresas} />

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Superadmin</th>
              {empresas.map((e) => (
                <th key={e.id} className="px-4 py-3 font-medium">
                  {e.nombre}
                </th>
              ))}
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {perfiles.map((p) => {
              const soyYo = p.usuario_id === yo.usuario_id;
              const nuevo = !p.acceso_total && !conAcceso.has(p.usuario_id);
              return (
                <tr key={p.usuario_id} className={p.activo ? "" : "bg-slate-50 text-slate-400"}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">
                      {p.nombre ?? "—"} {soyYo && <span className="text-xs text-slate-400">(usted)</span>}
                      {nuevo && p.activo && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Nuevo</span>
                      )}
                    </p>
                    <p className="text-slate-500">{p.correo}</p>
                    <CampoCelular usuarioId={p.usuario_id} celular={p.celular} />
                  </td>
                  <td className="px-4 py-3">
                    <form action={cambiarAccesoTotal}>
                      <input type="hidden" name="usuario_id" value={p.usuario_id} />
                      <input type="hidden" name="valor" value={String(!p.acceso_total)} />
                      <button
                        disabled={soyYo}
                        title={soyYo ? "No puede quitarse el superadmin a sí mismo" : undefined}
                        className={`rounded-full px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed ${
                          p.acceso_total ? "bg-violet-700 text-white" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {p.acceso_total ? "★ Sí" : "No"}
                      </button>
                    </form>
                  </td>
                  {empresas.map((e) => (
                    <td key={e.id} className="px-4 py-3">
                      {p.acceso_total ? (
                        <span className="text-xs text-slate-500">Todo (superadmin)</span>
                      ) : (
                        <SelectorRol
                          usuarioId={p.usuario_id}
                          correo={p.correo}
                          empresaId={e.id}
                          rol={rolDe.get(`${p.usuario_id}:${e.id}`) ?? ""}
                          deshabilitado={soyYo || !p.activo}
                        />
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    {soyYo ? (
                      <span className="text-xs text-green-700">Activo</span>
                    ) : (
                      <form action={cambiarActivo} className="flex items-center gap-2">
                        <input type="hidden" name="usuario_id" value={p.usuario_id} />
                        <input type="hidden" name="valor" value={String(!p.activo)} />
                        <span className={`text-xs font-semibold ${p.activo ? "text-green-700" : "text-red-600"}`}>
                          {p.activo ? "Activo" : "Inactivo"}
                        </span>
                        <button className="text-xs font-medium text-blue-700 hover:underline">{p.activo ? "Inactivar" : "Activar"}</button>
                      </form>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <RestablecerClave usuarioId={p.usuario_id} nombre={p.nombre ?? p.correo} />
                      {!soyYo && <EliminarUsuario usuarioId={p.usuario_id} nombre={p.nombre ?? p.correo} />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
