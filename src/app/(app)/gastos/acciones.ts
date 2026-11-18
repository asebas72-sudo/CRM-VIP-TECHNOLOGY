"use server";

import { revalidatePath } from "next/cache";
import { exigirRol } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";
import { CATEGORIAS, FORMAS_PAGO_GASTO } from "./opciones";

export type Resultado = { ok?: boolean; error?: string };

function refrescar() {
  revalidatePath("/gastos");
  revalidatePath("/informes");
}

/** Registra un gasto o una inversión en la empresa activa. */
export async function registrarGasto(_: Resultado, form: FormData): Promise<Resultado> {
  const { activa } = await exigirRol("admin", "bodega", "vendedor");
  const texto = (c: string) => String(form.get(c) ?? "").trim();
  const tipo = texto("tipo");
  const categoria = texto("categoria");
  const fecha = texto("fecha");
  const descripcion = texto("descripcion");
  const formaPago = texto("forma_pago");
  const valor = Number(texto("valor").replace(/\./g, "").replace(",", "."));

  if (!CATEGORIAS[tipo]?.[categoria]) return { error: "Elija el tipo y la categoría." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Revise la fecha." };
  if (descripcion.length < 2) return { error: "Escriba en qué se gastó." };
  if (!Number.isFinite(valor) || valor <= 0) return { error: "El valor debe ser mayor que cero." };
  if (!FORMAS_PAGO_GASTO[formaPago]) return { error: "Elija la forma de pago." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("gastos").insert({
    empresa_id: activa.id,
    tipo,
    categoria,
    fecha,
    descripcion,
    valor: Math.round(valor),
    forma_pago: formaPago,
    beneficiario: texto("beneficiario") || null,
  });
  if (error) return { error: error.message };

  refrescar();
  return { ok: true };
}

/** Solo el administrador de la empresa borra un registro. */
export async function borrarGasto(id: string): Promise<Resultado> {
  const { activa } = await exigirRol("admin");
  const supabase = await crearClienteServidor();
  const { error, count } = await supabase.from("gastos").delete({ count: "exact" }).eq("empresa_id", activa.id).eq("id", id);
  if (error) return { error: error.message };
  if (!count) return { error: "No se encontró el registro." };
  refrescar();
  return { ok: true };
}
