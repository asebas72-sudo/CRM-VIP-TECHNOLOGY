import { headers } from "next/headers";
import Link from "next/link";
import { exigirRol } from "@/lib/empresa";
import { urlImagenPortafolio } from "@/lib/portafolio";
import { crearClienteServidor } from "@/lib/supabase/server";
import { GeneradorRedes } from "./generador";
import type { ItemPieza } from "./piezas";

/** Imágenes y textos listos para programar en Meta Business Suite. Solo administradores. */
export default async function PaginaRedes() {
  const { activa } = await exigirRol("admin");
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

  const volver = (
    <Link href="/portafolio" className="text-sm text-blue-700 hover:underline">
      ← Portafolio
    </Link>
  );

  const config = configRes.data;
  if (!config) {
    return (
      <div className="space-y-3">
        {volver}
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          Primero llene y guarde los datos en Portafolio para poder crear las imágenes.
        </p>
      </div>
    );
  }

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

  return (
    <div className="space-y-6">
      <div>
        {volver}
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Imágenes para Facebook e Instagram</h1>
        <p className="text-sm text-slate-500">
          Elija un producto publicado, descargue sus imágenes y prográmelas en Meta Business Suite.
        </p>
      </div>
      <GeneradorRedes
        items={items}
        preciosInicial={config.mostrar_precios}
        marca={{
          empresa: activa.nombre,
          color: config.color,
          logoUrl: urlImagenPortafolio(config.logo_path),
          whatsapp: config.whatsapp,
          enlace: `${protocolo}://${host}/catalogo/${config.slug}`,
        }}
      />
    </div>
  );
}
