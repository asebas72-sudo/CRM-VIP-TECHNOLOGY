import { headers } from "next/headers";
import { exigirRol } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioConfiguracion, type ConfigPortafolio } from "./configuracion";
import { ListaItems, type ItemPortafolio } from "./items";

function slugInicial(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Portafolio de la empresa activa: qué se publica y cómo se ve. Solo administradores. */
export default async function PaginaPortafolio() {
  const { activa } = await exigirRol("admin");
  const supabase = await crearClienteServidor();

  const [configRes, itemsRes] = await Promise.all([
    supabase.from("portafolio_config").select("*").eq("empresa_id", activa.id).maybeSingle(),
    supabase
      .from("productos")
      .select("id, codigo, nombre, precio_venta, stock, es_servicio, publicar_portafolio, descripcion_comercial, foto_path, etiqueta_portafolio")
      .eq("empresa_id", activa.id)
      .eq("activo", true)
      .order("nombre")
      .limit(2000),
  ]);

  const error = configRes.error ?? itemsRes.error;
  if (error) {
    return (
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
        No se pudo abrir el portafolio ({error.message}). Verifique que esté ejecutada la migración 0016.
      </p>
    );
  }

  const encabezados = await headers();
  const host = encabezados.get("x-forwarded-host") ?? encabezados.get("host") ?? "";
  const protocolo = encabezados.get("x-forwarded-proto") ?? "https";

  const config = configRes.data as ConfigPortafolio | null;
  const items = (itemsRes.data ?? []) as ItemPortafolio[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Portafolio de {activa.nombre}</h1>
        <p className="text-sm text-slate-500">
          Elija qué productos y servicios se publican. Los cambios de precio y existencias se reflejan solos.
        </p>
      </div>
      <FormularioConfiguracion config={config} slugSugerido={slugInicial(activa.nombre)} origen={`${protocolo}://${host}`} />
      <ListaItems items={items} />
    </div>
  );
}
