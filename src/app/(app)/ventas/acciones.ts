"use server";

import { revalidatePath } from "next/cache";
import { exigirRol, sesionActual } from "@/lib/empresa";
import { crearClienteServidor } from "@/lib/supabase/server";

export type ProductoVenta = {
  id: string;
  codigo: string;
  nombre: string;
  precio_venta: number;
  stock: number;
  maneja_serial: boolean;
  ubicacion: string | null;
};

/**
 * Busca por código exacto (escáner/QR) y, si no, por nombre o código parcial.
 * `exacto` indica que el código coincide tal cual: el punto de venta lo agrega directo.
 */
export async function buscarProductos(texto: string): Promise<{ exacto: boolean; productos: ProductoVenta[] }> {
  const { activa } = await sesionActual();
  const q = texto.trim();
  if (!activa || !q) return { exacto: false, productos: [] };

  const supabase = await crearClienteServidor();
  const columnas = "id, codigo, nombre, precio_venta, stock, maneja_serial, ubicacion";

  const { data: exacto } = await supabase
    .from("productos")
    .select(columnas)
    .eq("empresa_id", activa.id)
    .eq("activo", true)
    .eq("codigo", q)
    .maybeSingle();
  if (exacto) return { exacto: true, productos: [exacto as ProductoVenta] };

  const limpio = q.replace(/[,()%*]/g, " ");
  const { data } = await supabase
    .from("productos")
    .select(columnas)
    .eq("empresa_id", activa.id)
    .eq("activo", true)
    .or(`nombre.ilike.%${limpio}%,codigo.ilike.%${limpio}%,marca.ilike.%${limpio}%`)
    .order("nombre")
    .limit(15);
  return { exacto: false, productos: (data ?? []) as ProductoVenta[] };
}

export async function serialesDisponibles(productoId: string): Promise<{ id: string; serial: string }[]> {
  const { activa } = await exigirRol("admin", "vendedor");
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("seriales")
    .select("id, serial")
    .eq("empresa_id", activa.id)
    .eq("producto_id", productoId)
    .eq("estado", "disponible")
    .order("serial");
  return data ?? [];
}

export type DatosVenta = {
  items: { producto_id: string; cantidad: number; descuento: number; serial_ids: string[] }[];
  forma_pago: "efectivo" | "tarjeta" | "transferencia" | "mixto";
  recibido: number | null;
  notas: string;
  cliente: { documento: string; nombre: string; telefono: string } | null;
};

export async function registrarVenta(
  datos: DatosVenta,
): Promise<{ ok: true; ventaId: string } | { ok: false; error: string }> {
  const { activa } = await exigirRol("admin", "vendedor");
  const supabase = await crearClienteServidor();

  const { data, error } = await supabase.rpc("registrar_venta", {
    p_empresa: activa.id,
    p_venta: {
      forma_pago: datos.forma_pago,
      recibido: datos.recibido,
      notas: datos.notas,
      cliente: datos.cliente,
    },
    p_items: datos.items,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/productos");
  revalidatePath("/ventas/historial");
  return { ok: true, ventaId: data as string };
}

export async function anularVenta(ventaId: string, motivo: string): Promise<{ error?: string }> {
  await exigirRol("admin");
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("anular_venta", { p_venta: ventaId, p_motivo: motivo });
  if (error) return { error: error.message };
  revalidatePath(`/ventas/${ventaId}`);
  revalidatePath("/ventas/historial");
  return {};
}
