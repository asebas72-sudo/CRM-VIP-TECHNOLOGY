import QRCode from "qrcode";

/**
 * Código QR en SVG, generado de forma síncrona (sirve en servidor y
 * navegador). `tamano` en píxeles o cualquier unidad CSS (ej. "18mm").
 */
export function CodigoQR({ valor, tamano = 96 }: { valor: string; tamano?: number | string }) {
  const { modules } = QRCode.create(valor || " ", { errorCorrectionLevel: "M" });
  const n = modules.size;
  const margen = 1;
  let ruta = "";
  for (let fila = 0; fila < n; fila++) {
    for (let col = 0; col < n; col++) {
      if (modules.data[fila * n + col]) ruta += `M${col + margen} ${fila + margen}h1v1h-1z`;
    }
  }
  const total = n + margen * 2;

  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      width={tamano}
      height={tamano}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Código QR ${valor}`}
    >
      <rect width={total} height={total} fill="#fff" />
      <path d={ruta} fill="#000" />
    </svg>
  );
}
