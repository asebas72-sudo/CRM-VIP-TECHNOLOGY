"use server";

import { exigirRol } from "@/lib/empresa";
import { mejorarImagen, type ResultadoIA } from "@/lib/ia-imagenes";

/** Solo administradores: consume el cupo diario de la cuenta de Cloudflare. */
export async function mejorarFoto(form: FormData): Promise<ResultadoIA> {
  await exigirRol("admin");
  return mejorarImagen(form);
}
