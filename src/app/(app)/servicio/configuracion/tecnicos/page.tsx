import { redirect } from "next/navigation";
import { sesionActual } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";
import { BotonActivoTecnico, FormularioTecnico } from "./formulario";

type Tecnico = { id: string; nombre: string; celular: string | null; activo: boolean; empresa_id: string | null };

export default async function PaginaTecnicos() {
  const { perfil, todas } = await sesionActual();
  if (!perfil.acceso_total) redirect("/servicio");

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("tecnicos")
    .select("id, nombre, celular, activo, empresa_id")
    .order("activo", { ascending: false })
    .order("nombre");
  const tecnicos = (data ?? []) as Tecnico[];
  const nombreEmpresa = new Map(todas.map((e) => [e.id, e.nombre]));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-sm text-slate-500">Configuración</p>
        <h1 className="text-2xl font-bold text-slate-900">Técnicos</h1>
        <p className="text-sm text-slate-500">
          Técnicos sin usuario: aparecen en «Técnico asignado» de órdenes y asesorías, pero no entran al sistema. Los técnicos
          con usuario se manejan en Usuarios (rol Técnico).
        </p>
      </div>

      {error ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          Esta opción aún no está lista en la base de datos (falta ejecutar la migración 0021_tecnicos_sin_usuario.sql).
        </p>
      ) : (
        <>
          <FormularioTecnico empresas={todas.map((e) => ({ id: e.id, nombre: e.nombre }))} />
          <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-2 font-medium">Nombre</th>
                  <th className="px-4 py-2 font-medium">Celular</th>
                  <th className="px-4 py-2 font-medium">Empresa</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tecnicos.map((t) => (
                  <tr key={t.id} className={t.activo ? "" : "text-slate-400"}>
                    <td className="px-4 py-2 font-medium">{t.nombre}</td>
                    <td className="px-4 py-2">{t.celular ?? "—"}</td>
                    <td className="px-4 py-2">{t.empresa_id ? (nombreEmpresa.get(t.empresa_id) ?? "—") : "Todas"}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          t.activo ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {t.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <BotonActivoTecnico id={t.id} activo={t.activo} />
                    </td>
                  </tr>
                ))}
                {tecnicos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      Aún no hay técnicos sin usuario.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
