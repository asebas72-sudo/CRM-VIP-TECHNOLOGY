import type { CellValue } from "exceljs";
import type { ProductoCatalogo } from "../importar/acciones";

/** Plantilla de Excel para cargar los productos de una compra manual. Todo ocurre en el navegador. */

export type LineaExcel = { nombre: string; cantidad: number; costo: number; iva: number };
export type LecturaExcel = { lineas: LineaExcel[]; errores: string[] };

const HOJA_COMPRA = "Compra";
const HOJA_INVENTARIO = "Inventario";
const FILAS_PLANTILLA = 500;
const IVAS = [0, 5, 19];

const COLUMNAS = {
  producto: "Producto",
  cantidad: "Cantidad",
  costo: "Costo unitario sin IVA",
  iva: "IVA %",
};

const cargarExcel = async () => (await import("exceljs")).default;

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** El archivo .xlsx de la plantilla, con el inventario de la empresa para elegir productos. */
export async function construirPlantilla(catalogo: ProductoCatalogo[]): Promise<ArrayBuffer> {
  const Excel = await cargarExcel();
  const libro = new Excel.Workbook();

  const hoja = libro.addWorksheet(HOJA_COMPRA, { views: [{ state: "frozen", ySplit: 1 }] });
  hoja.columns = [
    { header: COLUMNAS.producto, key: "producto", width: 55 },
    { header: COLUMNAS.cantidad, key: "cantidad", width: 12 },
    { header: COLUMNAS.costo, key: "costo", width: 24 },
    { header: COLUMNAS.iva, key: "iva", width: 10 },
  ];
  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
  encabezado.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };

  const inventario = libro.addWorksheet(HOJA_INVENTARIO);
  inventario.columns = [
    { header: "Producto", key: "nombre", width: 55 },
    { header: "Código", key: "codigo", width: 18 },
    { header: "Stock", key: "stock", width: 10 },
  ];
  inventario.getRow(1).font = { bold: true };
  inventario.addRows(catalogo.map((p) => ({ nombre: p.nombre, codigo: p.codigo, stock: Number(p.stock) })));

  for (let fila = 2; fila <= FILAS_PLANTILLA + 1; fila++) {
    if (catalogo.length > 0) {
      // Lista de sugerencias; se permite escribir un producto que no esté (se crea como nuevo)
      hoja.getCell(`A${fila}`).dataValidation = {
        type: "list",
        allowBlank: true,
        showErrorMessage: false,
        formulae: [`${HOJA_INVENTARIO}!$A$2:$A$${catalogo.length + 1}`],
      };
    }
    hoja.getCell(`D${fila}`).dataValidation = {
      type: "list",
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "IVA",
      error: "Use 0, 5 o 19",
      formulae: [`"${IVAS.join(",")}"`],
    };
    hoja.getCell(`D${fila}`).value = 0;
  }

  return (await libro.xlsx.writeBuffer()) as ArrayBuffer;
}

function textoCelda(valor: CellValue): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "string" || typeof valor === "number" || typeof valor === "boolean") return String(valor).trim();
  if (valor instanceof Date) return "";
  if ("richText" in valor) return valor.richText.map((t) => t.text).join("").trim();
  if ("text" in valor) return String(valor.text).trim();
  if ("result" in valor && valor.result !== undefined) return textoCelda(valor.result as CellValue);
  return "";
}

/** Número de una celda: acepta números reales y textos como "1.234,50", "$ 1.234" o "1234.5". */
function numeroCelda(valor: CellValue): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  const t = textoCelda(valor).replace(/[$\s%]/g, "");
  if (!t) return null;
  let limpio: string;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) limpio = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) limpio = t.replace(/,/g, "");
  else limpio = t.replace(",", ".");
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** Lee los productos del archivo. Las filas con problemas se informan y no se cargan. */
export async function leerPlantilla(archivo: File): Promise<LecturaExcel> {
  const Excel = await cargarExcel();
  const libro = new Excel.Workbook();
  try {
    await libro.xlsx.load(await archivo.arrayBuffer());
  } catch {
    return { lineas: [], errores: ["No se pudo abrir el archivo. Debe ser un Excel .xlsx; use la plantilla."] };
  }

  const hoja = libro.getWorksheet(HOJA_COMPRA) ?? libro.worksheets[0];
  if (!hoja) return { lineas: [], errores: ["El archivo no tiene hojas."] };

  // Las columnas se ubican por su título, por si cambian de orden
  const posicion = new Map<string, number>();
  hoja.getRow(1).eachCell((celda, columna) => posicion.set(normalizar(textoCelda(celda.value)), columna));
  const columna = (titulo: string) => posicion.get(normalizar(titulo));
  const [cProducto, cCantidad, cCosto, cIva] = [COLUMNAS.producto, COLUMNAS.cantidad, COLUMNAS.costo, COLUMNAS.iva].map(columna);
  if (!cProducto || !cCantidad || !cCosto) {
    return {
      lineas: [],
      errores: [`Faltan columnas. La primera fila debe tener: ${COLUMNAS.producto}, ${COLUMNAS.cantidad} y ${COLUMNAS.costo}.`],
    };
  }

  const lineas: LineaExcel[] = [];
  const errores: string[] = [];
  for (let f = 2; f <= hoja.rowCount; f++) {
    const fila = hoja.getRow(f);
    const nombre = textoCelda(fila.getCell(cProducto).value);
    const cantidadCelda = fila.getCell(cCantidad).value;
    const costoCelda = fila.getCell(cCosto).value;

    // Fila vacía (el IVA viene en 0 por defecto en la plantilla)
    if (!nombre && !textoCelda(cantidadCelda) && !textoCelda(costoCelda)) continue;

    const cantidad = numeroCelda(cantidadCelda);
    const costo = numeroCelda(costoCelda);
    let iva = cIva ? (numeroCelda(fila.getCell(cIva).value) ?? 0) : 0;
    // Celda con formato de porcentaje: 19% llega como 0,19
    if (iva > 0 && iva < 1) iva = Math.round(iva * 100);

    if (!nombre) errores.push(`Fila ${f}: falta el producto.`);
    else if (cantidad === null || cantidad <= 0) errores.push(`Fila ${f} (${nombre}): cantidad inválida.`);
    else if (costo === null || costo < 0) errores.push(`Fila ${f} (${nombre}): costo inválido.`);
    else if (!IVAS.includes(iva)) errores.push(`Fila ${f} (${nombre}): el IVA debe ser 0, 5 o 19.`);
    else lineas.push({ nombre, cantidad, costo, iva });
  }
  return { lineas, errores };
}
