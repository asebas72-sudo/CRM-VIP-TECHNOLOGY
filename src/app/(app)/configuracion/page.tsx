import { exigirRol } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioConfiguracion, type ConfiguracionEmpresa } from "./formulario";

export default async function PaginaConfiguracion() {
  const { activa } = await exigirRol("admin");
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("empresas")
    .select("id, nombre, nit, direccion, telefono, ciudad, departamento, encabezado_tirilla, pie_tirilla, ancho_tirilla_mm, margen_defecto")
    .eq("id", activa.id)
    .single();
  if (error) throw new Error(error.message);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
        <p className="text-sm text-slate-500">
          Datos de <strong>{activa.nombre}</strong> que salen en la tirilla y valores por defecto.
        </p>
      </div>
      <FormularioConfiguracion empresa={data as ConfiguracionEmpresa} />
    </div>
  );
}
