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

/**
 * Crea el servicio en cada empresa elegida, con el código automático de cada una
 * (S00001, S00002...). Donde ya exista un servicio con ese nombre no se duplica.
 */
export async function crearServicio(d: DatosServicio, empresaIds: string[]): Promise<{ error?: string; resumen?: string }> {
  const { todas } = await exigirRol("admin");
  const problema = validar(d);
  if (problema) return { error: problema };

  const empresas = todas.filter((e) => e.rol === "admin" && empresaIds.includes(e.id));
  if (empresas.length === 0) return { error: "Elija al menos una empresa." };

  const supabase = await crearClienteServidor();
  const nombre = d.nombre.trim();
  const creadas: string[] = [];
  const omitidas: string[] = [];
  const errores: string[] = [];

  for (const empresa of empresas) {
    const { data, error: errorLectura } = await supabase
      .from("productos")
      .select("codigo, nombre, es_servicio")
      .eq("empresa_id", empresa.id)
      .or("codigo.like.S%,es_servicio.eq.true");
    if (errorLectura) {
      errores.push(`${empresa.nombre}: ${errorLectura.message}`);
      continue;
    }
    if ((data ?? []).some((p) => p.es_servicio && p.nombre.trim().toLowerCase() === nombre.toLowerCase())) {
      omitidas.push(empresa.nombre);
      continue;
    }
    const ultimo = (data ?? []).reduce((max, p) => {
      const m = /^S(\d+)$/.exec(p.codigo);
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);

    const { error } = await supabase.from("productos").insert({
      empresa_id: empresa.id,
      codigo: `S${String(ultimo + 1).padStart(5, "0")}`,
      nombre,
      descripcion_comercial: d.descripcion.trim() || null,
      precio_venta: Math.round(d.precio),
      iva_porcentaje: d.iva,
      publicar_portafolio: d.publicar,
      es_servicio: true,
      maneja_serial: false,
    });
    if (error) errores.push(`${empresa.nombre}: ${error.message}`);
    else creadas.push(empresa.nombre);
  }

  refrescar();
  const partes = [
    creadas.length ? `Creado en: ${creadas.join(", ")}.` : "",
    omitidas.length ? `Ya existía en: ${omitidas.join(", ")}.` : "",
  ].filter(Boolean);
  return { resumen: partes.join(" ") || undefined, error: errores.length ? errores.join(" ") : undefined };
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
