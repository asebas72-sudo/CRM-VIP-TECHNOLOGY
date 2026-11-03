import { XMLParser } from "fast-xml-parser";

/**
 * Lector de facturas electrónicas DIAN (UBL 2.1).
 * Acepta tanto el AttachedDocument (contenedor que envían los proveedores,
 * con la factura dentro de un CDATA) como el Invoice directo.
 */

export type ParteFactura = {
  nit: string;
  nombre: string;
};

export type LineaFactura = {
  linea: number;
  codigoProveedor: string;
  descripcion: string; // sin la lista de seriales
  descripcionOriginal: string;
  marca: string | null;
  cantidad: number;
  costoUnitario: number; // sin IVA
  subtotal: number; // sin IVA
  ivaPorcentaje: number;
  ivaValor: number;
  total: number; // con IVA
  seriales: string[];
};

export type FacturaDian = {
  numero: string;
  cufe: string | null;
  fecha: string; // AAAA-MM-DD
  proveedor: ParteFactura;
  cliente: ParteFactura;
  subtotal: number;
  iva: number;
  total: number;
  lineas: LineaFactura[];
};

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
  isArray: (nombre) =>
    ["InvoiceLine", "TaxTotal", "TaxSubtotal", "Attachment"].includes(nombre),
});

type Nodo = Record<string, unknown>;

function texto(valor: unknown): string {
  if (valor == null) return "";
  if (typeof valor === "string") return valor;
  if (typeof valor === "number") return String(valor);
  if (Array.isArray(valor)) return texto(valor[0]);
  if (typeof valor === "object" && "#text" in (valor as Nodo)) {
    return texto((valor as Nodo)["#text"]);
  }
  return "";
}

function numero(valor: unknown): number {
  const n = Number.parseFloat(texto(valor));
  return Number.isFinite(n) ? n : 0;
}

function nodo(valor: unknown): Nodo {
  if (Array.isArray(valor)) return (valor[0] as Nodo) ?? {};
  return (valor as Nodo) ?? {};
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

function leerParte(contenedor: unknown): ParteFactura {
  const party = nodo(nodo(contenedor).Party);
  const esquema = nodo(party.PartyTaxScheme);
  const legal = nodo(party.PartyLegalEntity);
  const nombre =
    texto(esquema.RegistrationName) ||
    texto(legal.RegistrationName) ||
    texto(nodo(party.PartyName).Name);
  const nit = texto(esquema.CompanyID) || texto(legal.CompanyID);
  return { nit, nombre };
}

/** Separa "PRODUCTO X SERIAL: A, SERIAL: B" en nombre y lista de seriales. */
export function separarSeriales(descripcion: string): {
  nombre: string;
  seriales: string[];
} {
  const indice = descripcion.search(/\bSERIAL\s*:/i);
  if (indice === -1) return { nombre: limpiarEspacios(descripcion), seriales: [] };
  const nombre = limpiarEspacios(descripcion.slice(0, indice));
  const seriales = [...descripcion.slice(indice).matchAll(/SERIAL\s*:\s*([^,\s]+)/gi)].map(
    (m) => m[1].trim(),
  );
  return { nombre, seriales: [...new Set(seriales)] };
}

function limpiarEspacios(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function leerLinea(linea: Nodo): LineaFactura {
  const item = nodo(linea.Item);
  const cantidad = numero(linea.InvoicedQuantity);
  const subtotal = numero(linea.LineExtensionAmount);

  let ivaValor = 0;
  let ivaPorcentaje = 0;
  for (const impuesto of (linea.TaxTotal as Nodo[] | undefined) ?? []) {
    for (const sub of (impuesto.TaxSubtotal as Nodo[] | undefined) ?? []) {
      const categoria = nodo(sub.TaxCategory);
      const esquema = nodo(categoria.TaxScheme);
      if (texto(esquema.ID) === "01" || /IVA/i.test(texto(esquema.Name))) {
        ivaValor += numero(sub.TaxAmount);
        ivaPorcentaje = numero(categoria.Percent);
      }
    }
  }

  const descripcionOriginal = texto(item.Description);
  const { nombre, seriales } = separarSeriales(descripcionOriginal);
  const codigoProveedor =
    texto(nodo(item.SellersItemIdentification).ID) ||
    texto(nodo(item.StandardItemIdentification).ID);
  const marca = texto(item.BrandName);

  return {
    linea: numero(linea.ID),
    codigoProveedor,
    descripcion: nombre,
    descripcionOriginal,
    marca: marca && marca !== "." ? marca : null,
    cantidad,
    costoUnitario: cantidad > 0 ? redondear(subtotal / cantidad) : 0,
    subtotal: redondear(subtotal),
    ivaPorcentaje,
    ivaValor: redondear(ivaValor),
    total: redondear(subtotal + ivaValor),
    seriales,
  };
}

function extraerInvoice(raiz: Nodo): Nodo {
  if (raiz.Invoice) return nodo(raiz.Invoice);

  const adjunto = nodo(raiz.AttachedDocument);
  for (const attachment of (adjunto.Attachment as Nodo[] | undefined) ?? []) {
    const contenido = texto(nodo(attachment.ExternalReference).Description);
    if (contenido.includes("<Invoice")) {
      const interno = parser.parse(contenido) as Nodo;
      if (interno.Invoice) return nodo(interno.Invoice);
    }
  }
  throw new Error("El XML no contiene una factura electrónica (Invoice) válida.");
}

export function leerFacturaDian(xml: string): FacturaDian {
  const invoice = extraerInvoice(parser.parse(xml) as Nodo);
  const totales = nodo(invoice.LegalMonetaryTotal);
  const lineas = ((invoice.InvoiceLine as Nodo[] | undefined) ?? []).map(leerLinea);

  if (lineas.length === 0) {
    throw new Error("La factura no tiene productos.");
  }

  const subtotal = numero(totales.LineExtensionAmount);
  const total = numero(totales.PayableAmount);
  const iva = lineas.reduce((suma, l) => suma + l.ivaValor, 0);

  return {
    numero: texto(invoice.ID),
    cufe: texto(invoice.UUID) || null,
    fecha: texto(invoice.IssueDate),
    proveedor: leerParte(invoice.AccountingSupplierParty),
    cliente: leerParte(invoice.AccountingCustomerParty),
    subtotal: redondear(subtotal),
    iva: redondear(iva),
    total: redondear(total),
    lineas,
  };
}
