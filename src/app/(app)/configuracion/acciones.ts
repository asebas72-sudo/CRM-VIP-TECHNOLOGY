"use server";

import { revalidatePath } from "next/cache";
import { exigirRol } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";

export type Resultado = { ok?: boolean; error?: string };

const texto = (form: FormData, campo: string) => String(form.get(campo) ?? "").trim() || null;

export async function guardarConfiguracion(_: Resultado, form: FormData): Promise<Resultado> {
  const { activa } = await exigirRol("admin");
  const nombre = texto(form, "nombre");
  const margen = Number(form.get("margen_defecto"));
  const ancho = Number(form.get("ancho_tirilla_mm"));
  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!Number.isFinite(margen) || margen < 0 || margen > 1000) return { error: "Margen inválido." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("empresas")
    .update({
      nombre,
      nit: texto(form, "nit"),
      direccion: texto(form, "direccion"),
      telefono: texto(form, "telefono"),
      ciudad: texto(form, "ciudad"),
      encabezado_tirilla: texto(form, "encabezado_tirilla"),
      pie_tirilla: texto(form, "pie_tirilla"),
      ancho_tirilla_mm: ancho === 58 ? 58 : 80,
      margen_defecto: margen,
    })
    .eq("id", activa.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
