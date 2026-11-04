/**
 * Lectura de los correos de notificación de pago ("Pago de: EMPRESA Para: ...").
 * Misma lógica del Apps Script anterior.
 */

export type LineaPago = {
  nroFactura: string;
  nroFacturaProveedor: string;
  valorPagado: number | null;
  reteFte: number | null;
};

export type DatosPago = {
  empresa: string;
  cuenta: string;
  banco: string;
  valorTotal: number | null;
  fechaPago: string | null; // AAAA-MM-DD
  fechaPagoTexto: string;
  lineas: LineaPago[];
};

const MESES: Record<string, string> = {
  ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06",
  jul: "07", ago: "08", sep: "09", oct: "10", nov: "11", dic: "12",
};

/** Los valores llegan con coma de miles y sin decimales: "1,032,008" o "-22,146". */
function valor(texto: string | undefined): number | null {
  if (!texto) return null;
  const n = Number(texto.replace(/,/g, "").replace(/\.$/, ""));
  return Number.isFinite(n) ? n : null;
}

/** 'Ago.27/2026' -> '2026-08-27' */
export function normalizarFechaPago(texto: string): string | null {
  const m = texto.match(/([A-Za-zÁÉÍÓÚñÑ]{3})\.?\s*(\d{1,2})\s*\/\s*(\d{4})/);
  if (!m) return null;
  const mes = MESES[m[1].toLowerCase()];
  return mes ? `${m[3]}-${mes}-${m[2].padStart(2, "0")}` : null;
}

export function extraerEmpresaDeAsunto(asunto: string): string {
  return asunto.match(/Pago de:\s*(.+?)\s+Para:/i)?.[1].trim() ?? "";
}

export function extraerDatosPago(textoCrudo: string): DatosPago {
  const texto = textoCrudo.replace(/\r/g, "");
  const datos: DatosPago = { empresa: "", cuenta: "", banco: "", valorTotal: null, fechaPago: null, fechaPagoTexto: "", lineas: [] };

  const encabezado = texto.match(
    /([\s\S]+?)\s+le informa que ha consignado a su cuenta\s+(\S+)\s+del banco\s+([^\n]+?)\s+el valor de\s+\$?\s*([\d.,]+)\s+en la fecha\s+([^\n,]+?)\s+correspondiente/i,
  );
  if (encabezado) {
    // Solo la última línea antes de la frase (por si el correo trae saludo arriba)
    const bloque = encabezado[1].trim().split("\n");
    datos.empresa = bloque[bloque.length - 1].trim();
    datos.cuenta = encabezado[2].trim();
    datos.banco = encabezado[3].trim();
    datos.valorTotal = valor(encabezado[4].trim());
    datos.fechaPagoTexto = encabezado[5].trim();
    datos.fechaPago = normalizarFechaPago(datos.fechaPagoTexto);
  }

  const regexLinea =
    /Nro\.\s*(\S+)\s*Nro\.\s*Factura\s*Prov\.\s*(\S+)\s*--\s*Valor Pagado\s+([-\d.,]+)\.\s*--(?:\s*ReteFte\s+([-\d.,]+)\.\s*--)?/gi;
  for (const m of texto.matchAll(regexLinea)) {
    datos.lineas.push({
      nroFactura: m[1].trim(),
      nroFacturaProveedor: m[2].trim(),
      valorPagado: valor(m[3]),
      reteFte: valor(m[4]),
    });
  }
  return datos;
}
