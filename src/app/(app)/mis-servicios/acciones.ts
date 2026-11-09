"use server";

import { revalidatePath } from "next/cache";
import { exigirRol } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";

export type DatosServicio = {
  nombre: string;
  descripcion: string;
  precio: number;
  iva: number;
  publicar: boolean;
};

const IVAS = [0, 5, 19];

function validar(d: DatosServicio): string | null {
  if (!d.nombre?.trim()) return "Escriba el nombre del servicio.";
  if (!Number.isFinite(d.precio) || d.precio < 0) return "Indique un precio válido.";
  if (!IVAS.includes(d.iva)) return "El IVA debe ser 0, 5 o 19.";
  return null;
}

function refrescar() {
  revalidatePath("/mis-servicios");
  revalidatePath("/portafolio");
}

/** Crea un servicio con código automático (S00001, S00002...). */
export async function crearServicio(d: DatosServicio): Promise<{ error?: string }> {
  const { activa } = await exigirRol("admin");
  const problema = validar(d);
  if (problema) return { error: problema };

  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("productos").select("codigo").eq("empresa_id", activa.id).like("codigo", "S%");
  const ultimo = (data ?? []).reduce((max, p) => {
    const m = /^S(\d+)$/.exec(p.codigo);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);

  const { error } = await supabase.from("productos").insert({
    empresa_id: activa.id,
    codigo: `S${String(ultimo + 1).padStart(5, "0")}`,
    nombre: d.nombre.trim(),
    descripcion_comercial: d.descripcion.trim() || null,
    precio_venta: Math.round(d.precio),
    iva_porcentaje: d.iva,
    publicar_portafolio: d.publicar,
    es_servicio: true,
    maneja_serial: false,
  });
  if (error) return { error: error.message };
  refrescar();
  return {};
}

export async function actualizarServicio(id: string, d: DatosServicio): Promise<{ error?: string }> {
  const { activa } = await exigirRol("admin");
  const problema = validar(d);
  if (problema) return { error: problema };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("productos")
    .update({
      nombre: d.nombre.trim(),
      descripcion_comercial: d.descripcion.trim() || null,
      precio_venta: Math.round(d.precio),
      iva_porcentaje: d.iva,
      publicar_portafolio: d.publicar,
      actualizado_en: new Date().toISOString(),
    })
    .eq("empresa_id", activa.id)
    .eq("id", id)
    .eq("es_servicio", true);
  if (error) return { error: error.message };
  refrescar();
  return {};
}

/** Los servicios no se borran para conservar el historial de ventas: se desactivan. */
export async function cambiarEstadoServicio(id: string, activo: boolean): Promise<{ error?: string }> {
  const { activa } = await exigirRol("admin");
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("productos")
    .update({ activo, actualizado_en: new Date().toISOString() })
    .eq("empresa_id", activa.id)
    .eq("id", id)
    .eq("es_servicio", true);
  if (error) return { error: error.message };
  refrescar();
  return {};
}
