"use server";

import { exigirRol } from "@/lib/empresa";
import { mejorarImagen, sugerirTextos, type ResultadoIA, type ResultadoTextos } from "@/lib/ia-imagenes";

/** Solo administradores: consume el cupo diario de la cuenta de Cloudflare. */
export async function mejorarFoto(form: FormData): Promise<ResultadoIA> {
  await exigirRol("admin");
  return mejorarImagen(form);
}

/** Propuestas de título y subtítulo para el anuncio. */
export async function sugerirTextosAnuncio(servicio: string, descripcion: string): Promise<ResultadoTextos> {
  const { activa } = await exigirRol("admin");
  return sugerirTextos(activa.nombre, servicio, descripcion);
}
