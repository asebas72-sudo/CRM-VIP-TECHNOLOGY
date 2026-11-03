/**
 * Prueba el lector de facturas DIAN con un XML local.
 * Uso: npm run probar-factura -- ruta/a/factura.xml
 */
import { readFileSync } from "node:fs";
import { leerFacturaDian } from "../src/lib/facturas/dian";

const rutas = process.argv.slice(2);
if (rutas.length === 0) {
  console.error("Indique la ruta de uno o más XML.");
  process.exit(1);
}

const pesos = (n: number) =>
  n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 });

for (const ruta of rutas) {
  const factura = leerFacturaDian(readFileSync(ruta, "utf8"));
  console.log(`\nFactura ${factura.numero} del ${factura.fecha}`);
  console.log(`Proveedor: ${factura.proveedor.nombre} (NIT ${factura.proveedor.nit})`);
  console.log(`Cliente:   ${factura.cliente.nombre} (${factura.cliente.nit})`);
  console.table(
    factura.lineas.map((l) => ({
      codigo: l.codigoProveedor,
      producto: l.descripcion.slice(0, 45),
      cant: l.cantidad,
      costo: l.costoUnitario,
      iva: `${l.ivaPorcentaje}%`,
      seriales: l.seriales.length,
    })),
  );

  const sumaLineas = factura.lineas.reduce((s, l) => s + l.total, 0);
  const seriales = factura.lineas.reduce((s, l) => s + l.seriales.length, 0);
  const unidades = factura.lineas.reduce((s, l) => s + l.cantidad, 0);
  console.log(`Subtotal ${pesos(factura.subtotal)} + IVA ${pesos(factura.iva)} = ${pesos(factura.total)}`);
  console.log(`Suma de líneas con IVA: ${pesos(sumaLineas)} | Unidades: ${unidades} | Seriales: ${seriales}`);
}
