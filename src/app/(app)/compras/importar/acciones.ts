"use server";

import { redirect } from "next/navigation";
import { exigirRol } from "@/lib/empresa";
import { leerFacturaDian, type FacturaDian } from "@/lib/facturas/dian";
import { crearClienteServidor } from "@/lib/supabase/server";

export type ProductoCatalogo = { id: string; codigo: string; nombre: string; stock: number };

export type LineaVistaPrevia = FacturaDian["lineas"][number] & {
  /** Código interno sugerido: el del producto ya enlazado o el del proveedor */
  codigoSugerido: string;
  /** Cómo se reconoció el producto existente */
  origen: "proveedor" | "codigo" | null;
};

export type VistaPrevia = {
  factura: Omit<FacturaDian, "lineas">;
  lineas: LineaVistaPrevia[];
  proveedorNuevo: boolean;
  duplicada: boolean;
  catalogo: ProductoCatalogo[];
};

export type EstadoAnalisis = { error?: string; vista?: VistaPrevia };

export type EdicionLinea = { codigo: string; nombre: string; manejaSerial: boolean };

async function leerArchivoXml(form: FormData): Promise<{ xml: string; archivo: File }> {
  const archivo = form.get("xml");
  if (!(archivo instanceof File) || archivo.size === 0) {
    throw new Error("Seleccione el archivo XML de la factura.");
  }
  if (!archivo.name.toLowerCase().endsWith(".xml")) {
    throw new Error("El archivo debe ser .xml (el PDF va en el campo opcional).");
  }
  return { xml: await archivo.text(), archivo };
}

/** Lee el XML y arma la vista previa: qué productos ya existen y cuáles son nuevos. */
export async function analizarFactura(_: EstadoAnalisis, form: FormData): Promise<EstadoAnalisis> {
  const { activa } = await exigirRol("admin", "bodega");

  let factura: FacturaDian;
  try {
    factura = leerFacturaDian((await leerArchivoXml(form)).xml);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo leer el XML." };
  }

  const supabase = await crearClienteServidor();
  const [proveedorRes, catalogoRes] = await Promise.all([
    supabase
      .from("proveedores")
      .select("id")
      .eq("empresa_id", activa.id)
      .eq("nit", factura.proveedor.nit)
      .maybeSingle(),
    supabase
      .from("productos")
      .select("id, codigo, nombre, stock")
      .eq("empresa_id", activa.id)
      .order("nombre"),
  ]);

  const catalogo = (catalogoRes.data ?? []) as ProductoCatalogo[];
  const porCodigo = new Map(catalogo.map((p) => [p.codigo, p]));
  const porId = new Map(catalogo.map((p) => [p.id, p]));

  let enlaces = new Map<string, string>();
  let duplicada = false;
  if (proveedorRes.data) {
    const [enlacesRes, compraRes] = await Promise.all([
      supabase
        .from("producto_proveedor")
        .select("codigo_proveedor, producto_id")
        .eq("empresa_id", activa.id)
        .eq("proveedor_id", proveedorRes.data.id),
      supabase
        .from("compras")
        .select("id")
        .eq("empresa_id", activa.id)
        .eq("proveedor_id", proveedorRes.data.id)
        .eq("numero_factura", factura.numero)
        .maybeSingle(),
    ]);
    enlaces = new Map((enlacesRes.data ?? []).map((e) => [e.codigo_proveedor, e.producto_id]));
    duplicada = Boolean(compraRes.data);
  }

  const lineas: LineaVistaPrevia[] = factura.lineas.map((linea) => {
    const enlazado = porId.get(enlaces.get(linea.codigoProveedor) ?? "");
    if (enlazado) return { ...linea, codigoSugerido: enlazado.codigo, origen: "proveedor" };
    if (porCodigo.has(linea.codigoProveedor)) {
      return { ...linea, codigoSugerido: linea.codigoProveedor, origen: "codigo" };
    }
    return { ...linea, codigoSugerido: linea.codigoProveedor || `L${linea.linea}`, origen: null };
  });

  const encabezado: VistaPrevia["factura"] = {
    numero: factura.numero,
    cufe: factura.cufe,
    fecha: factura.fecha,
    proveedor: factura.proveedor,
    cliente: factura.cliente,
    subtotal: factura.subtotal,
    iva: factura.iva,
    total: factura.total,
  };
  return {
    vista: { factura: encabezado, lineas, proveedorNuevo: !proveedorRes.data, duplicada, catalogo },
  };
}

/**
 * Importa la compra. Vuelve a leer el XML en el servidor (las cantidades y
 * costos nunca se toman del navegador); del formulario solo se usan las
 * decisiones del usuario: código, nombre y si maneja serial.
 */
export async function importarCompra(form: FormData): Promise<{ error?: string }> {
  const { activa } = await exigirRol("admin", "bodega");

  let factura: FacturaDian;
  let archivoXml: File;
  try {
    const leido = await leerArchivoXml(form);
    archivoXml = leido.archivo;
    factura = leerFacturaDian(leido.xml);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo leer el XML." };
  }

  const ediciones = JSON.parse(String(form.get("ediciones") ?? "[]")) as EdicionLinea[];
  if (ediciones.length !== factura.lineas.length) {
    return { error: "La vista previa no coincide con el archivo. Vuelva a cargarlo." };
  }

  const lineas = factura.lineas.map((l, i) => {
    const codigo = ediciones[i].codigo.trim();
    const nombre = ediciones[i].nombre.trim() || l.descripcion;
    return {
      codigo,
      nombre,
      marca: l.marca,
      codigo_proveedor: l.codigoProveedor,
      descripcion: l.descripcionOriginal,
      cantidad: l.cantidad,
      costo_unitario: l.costoUnitario,
      iva_porcentaje: l.ivaPorcentaje,
      iva_valor: l.ivaValor,
      total: l.total,
      maneja_serial: ediciones[i].manejaSerial,
      seriales: ediciones[i].manejaSerial ? l.seriales : [],
    };
  });
  if (lineas.some((l) => !l.codigo)) return { error: "Todos los productos deben tener código." };

  const supabase = await crearClienteServidor();
  const { data: compraId, error } = await supabase.rpc("importar_compra", {
    p_empresa: activa.id,
    p_compra: {
      numero: factura.numero,
      cufe: factura.cufe,
      fecha: factura.fecha,
      subtotal: factura.subtotal,
      iva: factura.iva,
      total: factura.total,
      proveedor_nit: factura.proveedor.nit,
      proveedor_nombre: factura.proveedor.nombre,
    },
    p_lineas: lineas,
  });
  if (error) return { error: error.message };

  // Respaldo del XML y del PDF (si se adjuntó). Si falla, la compra ya quedó registrada.
  const carpeta = `${activa.id}/${compraId}`;
  const rutas: { xml_path?: string; pdf_path?: string } = {};
  const subidaXml = await supabase.storage
    .from("compras")
    .upload(`${carpeta}/${factura.numero}.xml`, archivoXml, { contentType: "application/xml", upsert: true });
  if (!subidaXml.error) rutas.xml_path = subidaXml.data.path;

  const pdf = form.get("pdf");
  if (pdf instanceof File && pdf.size > 0) {
    const subidaPdf = await supabase.storage
      .from("compras")
      .upload(`${carpeta}/${factura.numero}.pdf`, pdf, { contentType: "application/pdf", upsert: true });
    if (!subidaPdf.error) rutas.pdf_path = subidaPdf.data.path;
  }
  if (rutas.xml_path || rutas.pdf_path) {
    await supabase.from("compras").update(rutas).eq("id", compraId);
  }

  redirect(`/compras/${compraId}`);
}
