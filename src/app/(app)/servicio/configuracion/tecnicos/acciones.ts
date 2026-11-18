"use server";

import { revalidatePath } from "next/cache";
import { sesionActual } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";

export type Resultado = { ok?: boolean; error?: string };

async function exigirSuperadmin(): Promise<string | null> {
  const { perfil } = await sesionActual();
  return perfil.acceso_total ? null : "Solo el superadmin puede gestionar los técnicos.";
}

function refrescar() {
  revalidatePath("/servicio", "layout");
}

/** Agrega un técnico sin usuario (solo nombre, para asignarlo a órdenes y asesorías). */
export async function crearTecnico(_: Resultado, form: FormData): Promise<Resultado> {
  const noPermitido = await exigirSuperadmin();
  if (noPermitido) return { error: noPermitido };
  const nombre = String(form.get("nombre") ?? "").trim().replace(/\s+/g, " ");
  const celular = String(form.get("celular") ?? "").replace(/\D/g, "");
  const empresa = String(form.get("empresa_id") ?? "");
  if (!nombre) return { error: "Escriba el nombre del técnico." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("tecnicos")
    .insert({ nombre, celular: celular || null, empresa_id: empresa || null });
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205")
      return { error: "Falta ejecutar la migración 0021_tecnicos_sin_usuario.sql en Supabase." };
    return { error: error.message };
  }
  refrescar();
  return { ok: true };
}

/** Activa o inactiva un técnico (no se borra para conservar el historial de órdenes). */
export async function cambiarActivoTecnico(id: string, activo: boolean): Promise<Resultado> {
  const noPermitido = await exigirSuperadmin();
  if (noPermitido) return { error: noPermitido };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("tecnicos").update({ activo }).eq("id", id);
  if (error) return { error: error.message };
  refrescar();
  return { ok: true };
}
