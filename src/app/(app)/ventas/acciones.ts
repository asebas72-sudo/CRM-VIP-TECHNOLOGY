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

export type ClienteVenta = { id: string; documento: string | null; nombre: string; telefono: string | null };

/** Clientes por documento o nombre, para elegir al vender. */
export async function buscarClientes(texto: string): Promise<ClienteVenta[]> {
  const { activa } = await exigirRol("admin", "vendedor");
  const q = texto.trim().replace(/[,()%*]/g, " ");
  if (q.length < 2) return [];
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("clientes")
    .select("id, documento, nombre, telefono")
    .eq("empresa_id", activa.id)
    .or("documento.is.null,documento.neq.222222222222")
    .or(`nombre.ilike.%${q}%,documento.ilike.%${q}%`)
    .order("nombre")
    .limit(10);
  return data ?? [];
}

export type TipoVenta = "contado" | "credito" | "separado";

export type DatosVenta = {
  items: { producto_id: string; cantidad: number; descuento: number; serial_ids: string[] }[];
  tipo: TipoVenta;
  forma_pago: "efectivo" | "tarjeta" | "transferencia" | "mixto";
  /** Solo crédito y separado: lo que paga hoy (puede ser 0) */
  abono_inicial: number;
  fecha_vencimiento: string | null;
  notas: string;
  /** Cliente existente, o datos de uno nuevo; sin ninguno va a CONSUMIDOR FINAL */
  cliente_id: string | null;
  cliente: { documento: string; nombre: string; telefono: string; departamento: string; ciudad: string } | null;
};

export async function registrarVenta(
  datos: DatosVenta,
): Promise<{ ok: true; ventaId: string } | { ok: false; error: string }> {
  const { activa } = await exigirRol("admin", "vendedor");
  const supabase = await crearClienteServidor();

  const { data, error } = await supabase.rpc("registrar_venta", {
    p_empresa: activa.id,
    p_venta: {
      tipo: datos.tipo,
      forma_pago: datos.forma_pago,
      abono_inicial: datos.abono_inicial,
      fecha_vencimiento: datos.fecha_vencimiento,
      notas: datos.notas,
      cliente_id: datos.cliente_id,
      cliente: datos.cliente,
    },
    p_items: datos.items,
  });
  if (error) return { ok: false, error: error.message };

  // Ubicación del cliente nuevo (la función SQL guarda documento, nombre y teléfono)
  if (datos.cliente && (datos.cliente.departamento || datos.cliente.ciudad)) {
    await supabase
      .from("clientes")
      .update({ departamento: datos.cliente.departamento || null, ciudad: datos.cliente.ciudad || null })
      .eq("empresa_id", activa.id)
      .eq("documento", datos.cliente.documento);
  }

  revalidatePath("/productos");
  revalidatePath("/ventas/historial");
  revalidatePath("/cartera");
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

export async function registrarAbono(
  ventaId: string,
  valor: number,
  forma: DatosVenta["forma_pago"],
  nota: string,
): Promise<{ error?: string; saldo?: number }> {
  await exigirRol("admin", "vendedor");
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("registrar_abono", {
    p_venta: ventaId,
    p_valor: valor,
    p_forma: forma,
    p_nota: nota,
  });
  if (error) return { error: error.message };
  revalidatePath(`/ventas/${ventaId}`);
  revalidatePath("/cartera");
  return { saldo: Number(data) };
}

export async function entregarVenta(ventaId: string): Promise<{ error?: string }> {
  await sesionActual();
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("entregar_venta", { p_venta: ventaId });
  if (error) return { error: error.message };
  revalidatePath(`/ventas/${ventaId}`);
  revalidatePath("/cartera");
  return {};
}
