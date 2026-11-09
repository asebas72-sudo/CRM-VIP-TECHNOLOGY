import { exigirRol } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ListaServicios, type Servicio } from "./lista";

/** Servicios que vende la empresa (reparación, instalación, asesoría...). Solo administradores. */
export default async function PaginaServicios() {
  const { activa } = await exigirRol("admin");
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("productos")
    .select("id, codigo, nombre, descripcion_comercial, precio_venta, iva_porcentaje, publicar_portafolio, activo")
    .eq("empresa_id", activa.id)
    .eq("es_servicio", true)
    .order("activo", { ascending: false })
    .order("nombre");

  if (error) {
    return (
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
        No se pudieron consultar los servicios ({error.message}). Verifique que esté ejecutada la migración 0016.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Servicios de {activa.nombre}</h1>
        <p className="text-sm text-slate-500">
          Los servicios tienen precio, se venden en <strong>Vender</strong> y no manejan inventario.
        </p>
      </div>
      <ListaServicios servicios={(data ?? []) as Servicio[]} />
    </div>
  );
}
