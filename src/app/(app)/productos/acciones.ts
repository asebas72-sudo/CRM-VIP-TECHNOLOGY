"use server";

import { revalidatePath } from "next/cache";
import { exigirRol } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";

export type Resultado = { ok?: boolean; error?: string };

function numero(valor: FormDataEntryValue | null): number {
  const n = Number(String(valor ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

/** Cambia solo el precio de venta (desde el listado). */
export async function actualizarPrecio(productoId: string, precio: number): Promise<Resultado> {
  const { activa } = await exigirRol("admin", "bodega");
  if (!Number.isFinite(precio) || precio < 0) return { error: "Precio inválido." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("productos")
    .update({ precio_venta: Math.round(precio), actualizado_en: new Date().toISOString() })
    .eq("empresa_id", activa.id)
    .eq("id", productoId);
  if (error) return { error: error.message };

  revalidatePath("/productos");
  return { ok: true };
}

export async function guardarProducto(_: Resultado, form: FormData): Promise<Resultado> {
  const { activa } = await exigirRol("admin", "bodega");
  const supabase = await crearClienteServidor();
  const id = String(form.get("id"));

  const codigo = String(form.get("codigo") ?? "").trim();
  const nombre = String(form.get("nombre") ?? "").trim();
  const precio = numero(form.get("precio_venta"));
  const iva = numero(form.get("iva_porcentaje"));
  const minimo = numero(form.get("stock_minimo"));
  if (!codigo || !nombre) return { error: "Código y nombre son obligatorios." };
  if (!(precio >= 0) || !(iva >= 0) || !(minimo >= 0)) return { error: "Revise precio, IVA y stock mínimo." };

  // Categoría: una existente o una nueva escrita por el usuario
  let categoriaId: string | null = String(form.get("categoria_id") ?? "") || null;
  const nuevaCategoria = String(form.get("categoria_nueva") ?? "").trim();
  if (nuevaCategoria) {
    const { data, error } = await supabase
      .from("categorias")
      .upsert({ empresa_id: activa.id, nombre: nuevaCategoria }, { onConflict: "empresa_id,nombre" })
      .select("id")
      .single();
    if (error) return { error: `No se pudo crear la categoría: ${error.message}` };
    categoriaId = data.id;
  }

  const { error } = await supabase
    .from("productos")
    .update({
      codigo,
      nombre,
      marca: String(form.get("marca") ?? "").trim() || null,
      categoria_id: categoriaId,
      precio_venta: Math.round(precio),
      iva_porcentaje: iva,
      stock_minimo: minimo,
      ubicacion: String(form.get("ubicacion") ?? "").trim() || null,
      maneja_serial: form.get("maneja_serial") === "on",
      activo: form.get("activo") === "on",
      actualizado_en: new Date().toISOString(),
    })
    .eq("empresa_id", activa.id)
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return { error: `Ya existe otro producto con el código ${codigo}.` };
    return { error: error.message };
  }

  revalidatePath("/productos");
  revalidatePath(`/productos/${id}`);
  return { ok: true };
}

export async function ajustarInventario(_: Resultado, form: FormData): Promise<Resultado> {
  await exigirRol("admin", "bodega");
  const cantidad = numero(form.get("cantidad"));
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("ajustar_inventario", {
    p_producto: String(form.get("producto_id")),
    p_tipo: String(form.get("tipo")),
    p_cantidad: cantidad,
    p_nota: String(form.get("nota") ?? ""),
  });
  if (error) return { error: error.message };

  revalidatePath(`/productos/${form.get("producto_id")}`);
  revalidatePath("/productos");
  return { ok: true };
}
