"use server";

import { leerFacturaDian } from "@/lib/facturas/dian";
import { crearClienteServidor } from "@/lib/supabase/server";

export type DetalleFactura = {
  cliente: { nit: string; nombre: string };
  subtotal: number;
  iva: number;
  total: number;
  lineas: {
    linea: number;
    codigo: string;
    descripcion: string;
    cantidad: number;
    costoUnitario: number;
    ivaPorcentaje: number;
    total: number;
    seriales: number;
  }[];
};

/** Lo comprado en una factura del correo, para revisarla antes de cargarla al inventario. */
export async function detalleFacturaCorreo(id: string): Promise<{ error?: string; detalle?: DetalleFactura }> {
  try {
    // Las políticas de la base solo dejan leer facturas de las empresas del usuario (admin o bodega)
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.from("facturas_correo").select("xml").eq("id", id).maybeSingle();
    if (error) return { error: error.message };
    if (!data?.xml) return { error: "No se encontró el XML de la factura." };

    const f = leerFacturaDian(data.xml);
    return {
      detalle: {
        cliente: f.cliente,
        subtotal: f.subtotal,
        iva: f.iva,
        total: f.total,
        lineas: f.lineas.map((l) => ({
          linea: l.linea,
          codigo: l.codigoProveedor,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          costoUnitario: l.costoUnitario,
          ivaPorcentaje: l.ivaPorcentaje,
          total: l.total,
          seriales: l.seriales.length,
        })),
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo leer la factura." };
  }
}
