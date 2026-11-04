"use server";

import { revalidatePath } from "next/cache";
import { revisarCorreo, type ResultadoRevision } from "@/lib/correo/procesar";
import { sesionActual } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";

async function exigirSuperadmin() {
  const { perfil } = await sesionActual();
  if (!perfil.acceso_total) throw new Error("Solo el superadmin puede usar este módulo.");
  return perfil;
}

/** Botón "Procesar ahora": revisa el correo sin esperar la tarea programada. */
export async function procesarAhora(): Promise<{ resultado?: ResultadoRevision; error?: string }> {
  try {
    await exigirSuperadmin();
    const resultado = await revisarCorreo();
    revalidatePath("/facturas-compra");
    return { resultado };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo revisar el correo." };
  }
}

/** Casilla "Cuenti": registrada en el sistema contable. */
export async function marcarCuenti(tabla: "facturas" | "pagos", id: string, valor: boolean): Promise<{ error?: string }> {
  try {
    const perfil = await exigirSuperadmin();
    const supabase = await crearClienteServidor();
    const { error } = await supabase
      .from(tabla === "facturas" ? "facturas_correo" : "pagos_correo")
      .update({ cuenti: valor, cuenti_por: valor ? perfil.usuario_id : null, cuenti_en: valor ? new Date().toISOString() : null })
      .eq("id", id);
    return error ? { error: error.message } : {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar." };
  }
}

/** Empresa a la que corresponde una factura (cuando no se reconoció por el NIT del comprador). */
export async function asignarEmpresa(facturaId: string, empresaId: string | null): Promise<{ error?: string }> {
  try {
    await exigirSuperadmin();
    const supabase = await crearClienteServidor();
    const { error } = await supabase.from("facturas_correo").update({ empresa_id: empresaId }).eq("id", facturaId);
    revalidatePath("/facturas-compra");
    return error ? { error: error.message } : {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar." };
  }
}

export type ConfigBuzon = { remitentes: string[]; asunto_pagos: string; prefijo_factura_pago: string; fecha_inicio: string };

export async function guardarConfigBuzon(config: ConfigBuzon): Promise<{ error?: string }> {
  try {
    await exigirSuperadmin();
    const remitentes = config.remitentes.map((r) => r.trim().toLowerCase()).filter((r) => /^\S+@\S+\.\S+$/.test(r));
    if (remitentes.length === 0) return { error: "Agregue al menos un correo remitente válido." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(config.fecha_inicio)) return { error: "Fecha de inicio inválida." };
    const supabase = await crearClienteServidor();
    const { error } = await supabase
      .from("buzon_config")
      .update({
        remitentes,
        asunto_pagos: config.asunto_pagos.trim() || "Pago de:",
        prefijo_factura_pago: config.prefijo_factura_pago.trim(),
        fecha_inicio: config.fecha_inicio,
      })
      .eq("id", 1);
    revalidatePath("/facturas-compra");
    return error ? { error: error.message } : {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar." };
  }
}
