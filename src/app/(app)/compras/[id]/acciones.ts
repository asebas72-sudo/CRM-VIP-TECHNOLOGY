"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirRol } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";

export type CambiosCompra = {
  proveedor_id: string;
  numero_factura: string;
  fecha: string;
  es_inversion: boolean;
  items: { id: string; cantidad: number; costo_unitario: number; iva_porcentaje: number; quitar: boolean }[];
};

/** Corrige una compra ya cargada (solo superadmin). Ajusta stock, kardex y costos. */
export async function editarCompra(compraId: string, cambios: CambiosCompra): Promise<{ error?: string }> {
  const { activa, perfil } = await exigirRol("admin");
  if (!perfil.acceso_total) return { error: "Solo un superadmin puede modificar compras." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cambios.fecha)) return { error: "Fecha inválida." };

  const supabase = await crearClienteServidor();
  const { data: compra } = await supabase
    .from("compras")
    .select("id")
    .eq("empresa_id", activa.id)
    .eq("id", compraId)
    .maybeSingle();
  if (!compra) return { error: "La compra no existe en esta empresa." };

  const { error } = await supabase.rpc("editar_compra", {
    p_compra: compraId,
    p_cabecera: { proveedor_id: cambios.proveedor_id, numero_factura: cambios.numero_factura, fecha: cambios.fecha },
    p_items: cambios.items,
  });
  if (error) {
    if (error.code === "PGRST202")
      return { error: "Falta ejecutar la migración 0019_editar_compra.sql en Supabase." };
    return { error: error.message };
  }

  const { error: errorInversion } = await supabase.rpc("editar_compra_inversion", {
    p_compra: compraId,
    p_es_inversion: cambios.es_inversion,
  });
  if (errorInversion) {
    if (errorInversion.code === "PGRST202")
      return { error: "Los demás cambios se guardaron, pero falta ejecutar la migración 0020_compras_inversion.sql para marcar inversión." };
    return { error: errorInversion.message };
  }

  revalidatePath("/informes");
  revalidatePath("/compras");
  revalidatePath(`/compras/${compraId}`);
  revalidatePath("/productos");
  redirect(`/compras/${compraId}`);
}

/** Elimina una compra importada por error y revierte su efecto en el inventario. */
export async function eliminarCompra(compraId: string): Promise<{ error?: string }> {
  const { activa } = await exigirRol("admin");
  const supabase = await crearClienteServidor();

  const { data: compra } = await supabase
    .from("compras")
    .select("xml_path, pdf_path")
    .eq("empresa_id", activa.id)
    .eq("id", compraId)
    .maybeSingle();
  if (!compra) return { error: "La compra no existe en esta empresa." };

  const { error } = await supabase.rpc("eliminar_compra", { p_compra: compraId });
  if (error) return { error: error.message };

  const archivos = [compra.xml_path, compra.pdf_path].filter((r): r is string => Boolean(r));
  if (archivos.length > 0) await supabase.storage.from("compras").remove(archivos);

  revalidatePath("/compras");
  redirect("/compras");
}
