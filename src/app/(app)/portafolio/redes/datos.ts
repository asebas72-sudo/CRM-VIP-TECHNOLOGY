import { headers } from "next/headers";
import { urlImagenPortafolio } from "@/lib/portafolio";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { EmpresaDelUsuario } from "@/lib/empresa";
import type { ItemPieza, MarcaPieza } from "./piezas";

export type DatosRedes = { items: ItemPieza[]; marca: MarcaPieza; preciosInicial: boolean };

/** Productos y servicios publicados y datos de marca; null si aún no se configuró el portafolio. */
export async function cargarDatosRedes(activa: EmpresaDelUsuario): Promise<DatosRedes | null> {
  const supabase = await crearClienteServidor();
  const [configRes, itemsRes] = await Promise.all([
    supabase.from("portafolio_config").select("slug, color, logo_path, whatsapp, mostrar_precios, agotados").eq("empresa_id", activa.id).maybeSingle(),
    supabase
      .from("productos")
      .select("id, nombre, descripcion_comercial, precio_venta, stock, es_servicio, foto_path, etiqueta_portafolio")
      .eq("empresa_id", activa.id)
      .eq("activo", true)
      .eq("publicar_portafolio", true)
      .order("nombre")
      .limit(2000),
  ]);
  const error = configRes.error ?? itemsRes.error;
  if (error) throw new Error(error.message);

  const config = configRes.data;
  if (!config) return null;

  const encabezados = await headers();
  const host = encabezados.get("x-forwarded-host") ?? encabezados.get("host") ?? "";
  const protocolo = encabezados.get("x-forwarded-proto") ?? "https";

  const items: ItemPieza[] = (itemsRes.data ?? [])
    .filter((p) => p.es_servicio || Number(p.stock) > 0 || config.agotados === "por_pedido")
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion_comercial,
      precio: Number(p.precio_venta),
      etiqueta: p.etiqueta_portafolio,
      disponibilidad: p.es_servicio || Number(p.stock) > 2 ? "disponible" : Number(p.stock) > 0 ? "pocas" : "por_pedido",
      fotoUrl: urlImagenPortafolio(p.foto_path),
      esServicio: p.es_servicio,
    }));

  return {
    items,
    preciosInicial: config.mostrar_precios,
    marca: {
      empresa: activa.nombre,
      color: config.color,
      logoUrl: urlImagenPortafolio(config.logo_path),
      whatsapp: config.whatsapp,
      enlace: `${protocolo}://${host}/catalogo/${config.slug}`,
    },
  };
}
