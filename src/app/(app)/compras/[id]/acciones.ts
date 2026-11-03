"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirRol } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";

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
