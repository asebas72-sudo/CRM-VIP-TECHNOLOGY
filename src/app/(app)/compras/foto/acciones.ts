"use server";

import { sesionActual, type EmpresaDelUsuario } from "@/lib/empresa";
import { leerDocumentoCompra, LecturaNoDisponible, type DocumentoLeido } from "@/lib/facturas/foto";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { ProductoCatalogo, ResultadoImportacion } from "../importar/acciones";

const TIPOS_ARCHIVO = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

async function empresaDestino(id: string): Promise<EmpresaDelUsuario> {
  const { todas } = await sesionActual();
  const empresa = todas.find((e) => e.id === id && (e.rol === "admin" || e.rol === "bodega"));
  if (!empresa) throw new Error("Seleccione una empresa en la que tenga permiso para cargar compras.");
  return empresa;
}

/** Productos de la empresa, para reconocer códigos existentes. */
export async function catalogoEmpresa(empresaId: string): Promise<ProductoCatalogo[]> {
  const empresa = await empresaDestino(empresaId);
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("productos")
    .select("id, codigo, nombre, stock")
    .eq("empresa_id", empresa.id)
    .order("nombre");
  return (data ?? []) as ProductoCatalogo[];
}

export async function leerFoto(form: FormData): Promise<{ documento?: DocumentoLeido; error?: string }> {
  const archivo = form.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Seleccione la foto o el PDF del documento." };
  if (!TIPOS_ARCHIVO.includes(archivo.type)) return { error: "Formato no soportado. Use JPG, PNG, WEBP o PDF." };
  try {
    await empresaDestino(String(form.get("empresa_id")));
    const documento = await leerDocumentoCompra({ datos: Buffer.from(await archivo.arrayBuffer()), tipo: archivo.type });
    if (!documento.es_documento_de_compra) {
      return { error: "La imagen no parece una factura, recibo o cuenta de cobro. Verifique el archivo." };
    }
    return { documento };
  } catch (e) {
    if (e instanceof LecturaNoDisponible || e instanceof Error) return { error: e.message };
    return { error: "No se pudo leer el documento." };
  }
}

export type LineaManual = {
  codigo: string;
  nombre: string;
  cantidad: number;
  costo_unitario: number; // sin IVA
  iva_porcentaje: number;
};

export type CompraManual = {
  tipo_documento: string;
  proveedor_nombre: string;
  proveedor_nit: string;
  numero: string;
  fecha: string;
  cufe: string;
  lineas: LineaManual[];
};

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Registra una compra escrita a mano o leída de una foto, con su soporte. */
export async function guardarCompraManual(form: FormData): Promise<ResultadoImportacion> {
  let empresa: EmpresaDelUsuario;
  try {
    empresa = await empresaDestino(String(form.get("empresa_id")));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const datos = JSON.parse(String(form.get("datos") ?? "{}")) as CompraManual;
  const proveedor = datos.proveedor_nombre?.trim();
  if (!proveedor) return { ok: false, error: "Escriba el nombre del proveedor." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha ?? "")) return { ok: false, error: "Indique la fecha del documento." };

  const lineas = (datos.lineas ?? []).filter((l) => l.nombre.trim() || l.codigo.trim());
  if (lineas.length === 0) return { ok: false, error: "Agregue al menos un producto." };
  for (const l of lineas) {
    if (!l.codigo.trim() || !l.nombre.trim()) return { ok: false, error: "Cada producto necesita código y nombre." };
    if (!(l.cantidad > 0)) return { ok: false, error: `Cantidad inválida en "${l.nombre}".` };
    if (!(l.costo_unitario >= 0)) return { ok: false, error: `Costo inválido en "${l.nombre}".` };
  }

  // Recibos sin NIT o sin número: se generan identificadores estables
  const nit = datos.proveedor_nit?.replace(/\D/g, "") || `SN-${slug(proveedor)}`;
  const numero = datos.numero?.trim() || `M-${datos.fecha.replace(/-/g, "")}-${Date.now().toString().slice(-5)}`;

  const items = lineas.map((l) => {
    const subtotal = redondear(l.cantidad * l.costo_unitario);
    const iva = redondear((subtotal * l.iva_porcentaje) / 100);
    return {
      codigo: l.codigo.trim(),
      nombre: l.nombre.trim(),
      marca: null,
      codigo_proveedor: "",
      descripcion: l.nombre.trim(),
      cantidad: l.cantidad,
      costo_unitario: redondear(l.costo_unitario),
      iva_porcentaje: l.iva_porcentaje,
      iva_valor: iva,
      total: redondear(subtotal + iva),
      maneja_serial: false,
      seriales: [],
    };
  });
  const subtotal = redondear(items.reduce((s, i) => s + i.cantidad * i.costo_unitario, 0));
  const iva = redondear(items.reduce((s, i) => s + i.iva_valor, 0));

  const supabase = await crearClienteServidor();
  const { data: compraId, error } = await supabase.rpc("importar_compra", {
    p_empresa: empresa.id,
    p_compra: {
      numero,
      cufe: datos.cufe?.trim() || null,
      fecha: datos.fecha,
      subtotal,
      iva,
      total: redondear(subtotal + iva),
      proveedor_nit: nit,
      proveedor_nombre: proveedor,
    },
    p_lineas: items,
  });
  if (error) return { ok: false, error: error.message };

  const archivo = form.get("archivo");
  const cambios: { origen: string; tipo_documento: string; soporte_path?: string } = {
    origen: archivo instanceof File && archivo.size > 0 ? "foto" : "manual",
    tipo_documento: datos.tipo_documento || "otro",
  };
  if (archivo instanceof File && archivo.size > 0 && TIPOS_ARCHIVO.includes(archivo.type)) {
    const extension = archivo.type === "application/pdf" ? "pdf" : archivo.type.split("/")[1];
    const subida = await supabase.storage
      .from("compras")
      .upload(`${empresa.id}/${compraId}/soporte.${extension}`, archivo, { contentType: archivo.type, upsert: true });
    if (!subida.error) cambios.soporte_path = subida.data.path;
  }
  await supabase.from("compras").update(cambios).eq("id", compraId);

  return { ok: true, compraId: compraId as string, empresaId: empresa.id, empresa: empresa.nombre, numero };
}
