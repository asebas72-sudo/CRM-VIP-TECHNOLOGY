"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

/**
 * Crea un producto a mano, sin factura de compra. Si no se escribe código se
 * asigna uno consecutivo (P00001...). La cantidad inicial entra al kardex
 * como ajuste de entrada "Inventario inicial".
 */
export async function crearProducto(_: Resultado, form: FormData): Promise<Resultado> {
  const { activa } = await exigirRol("admin", "bodega");
  const supabase = await crearClienteServidor();

  let codigo = String(form.get("codigo") ?? "").trim();
  const nombre = String(form.get("nombre") ?? "").trim();
  const precio = numero(form.get("precio_venta") || "0");
  const iva = numero(form.get("iva_porcentaje") || "0");
  const costo = numero(form.get("costo") || "0");
  const minimo = numero(form.get("stock_minimo") || "0");
  const inicial = numero(form.get("stock_inicial") || "0");
  if (!nombre) return { error: "Escriba el nombre del producto." };
  if (!(precio >= 0) || !(iva >= 0) || !(costo >= 0) || !(minimo >= 0) || !(inicial >= 0)) {
    return { error: "Revise los valores numéricos: no pueden ser negativos ni tener letras." };
  }

  if (!codigo) {
    const { data, error } = await supabase.from("productos").select("codigo").eq("empresa_id", activa.id).like("codigo", "P%");
    if (error) return { error: error.message };
    const ultimo = (data ?? []).reduce((max, p) => {
      const m = /^P(\d+)$/.exec(p.codigo);
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);
    codigo = `P${String(ultimo + 1).padStart(5, "0")}`;
  }

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

  const { data: creado, error } = await supabase
    .from("productos")
    .insert({
      empresa_id: activa.id,
      codigo,
      nombre,
      marca: String(form.get("marca") ?? "").trim() || null,
      categoria_id: categoriaId,
      precio_venta: Math.round(precio),
      iva_porcentaje: iva,
      costo_promedio: costo,
      ultimo_costo: costo,
      stock_minimo: minimo,
      ubicacion: String(form.get("ubicacion") ?? "").trim() || null,
      maneja_serial: form.get("maneja_serial") === "on",
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: `Ya existe un producto con el código ${codigo}.` };
    return { error: error.message };
  }

  if (inicial > 0) {
    const { error: errorAjuste } = await supabase.rpc("ajustar_inventario", {
      p_producto: creado.id,
      p_tipo: "ajuste_entrada",
      p_cantidad: inicial,
      p_nota: "Inventario inicial",
    });
    if (errorAjuste) {
      revalidatePath("/productos");
      redirect(`/productos/${creado.id}?aviso=sin-stock`);
    }
  }

  revalidatePath("/productos");
  redirect(`/productos/${creado.id}`);
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
