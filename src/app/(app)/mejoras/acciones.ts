"use server";

import { revalidatePath } from "next/cache";
import { sesionActual } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";
import { AREAS, ESTADOS, PRIORIDADES, TIPOS } from "./opciones";

export type Resultado = { ok?: boolean; error?: string };

function refrescar() {
  revalidatePath("/mejoras");
  revalidatePath("/servicio/mejoras");
}

/** Cualquier usuario registra una mejora o algo que le falta al sistema. */
export async function crearMejora(_: Resultado, form: FormData): Promise<Resultado> {
  const { activa } = await sesionActual();
  const texto = (c: string) => String(form.get(c) ?? "").trim();
  const tipo = texto("tipo");
  const area = texto("area");
  const prioridad = texto("prioridad");
  const titulo = texto("titulo");
  const descripcion = texto("descripcion");

  if (titulo.length < 3) return { error: "Escriba un título corto que resuma la mejora." };
  if (descripcion.length < 3) return { error: "Cuéntenos con más detalle qué necesita." };
  if (titulo.length > 150) return { error: "El título es muy largo (máximo 150 caracteres)." };
  if (descripcion.length > 4000) return { error: "La descripción es muy larga (máximo 4000 caracteres)." };
  if (!(tipo in TIPOS) || !(area in AREAS) || !(prioridad in PRIORIDADES)) return { error: "Revise las opciones elegidas." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("mejoras").insert({
    empresa_id: activa?.id ?? null,
    tipo,
    area,
    prioridad,
    titulo,
    descripcion,
  });
  if (error) return { error: error.message };

  refrescar();
  return { ok: true };
}

/** Solo quien tiene acceso total cambia el estado y responde. */
export async function gestionarMejora(id: string, estado: string, respuesta: string): Promise<Resultado> {
  const { perfil } = await sesionActual();
  if (!perfil.acceso_total) return { error: "Solo los administradores del sistema pueden gestionar las mejoras." };
  if (!(estado in ESTADOS)) return { error: "Estado inválido." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("mejoras")
    .update({ estado, respuesta: respuesta.trim() || null, actualizado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  refrescar();
  return { ok: true };
}
