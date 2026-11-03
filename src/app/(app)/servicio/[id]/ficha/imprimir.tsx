"use client";

import { useEffect } from "react";

/** Abre el cuadro de impresión al cargar (cuando se llega con ?imprimir=1) y deja un botón para repetir. */
export function ImprimirAlAbrir({ activo }: { activo: boolean }) {
  useEffect(() => {
    // Espera a que carguen la firma y el QR antes de imprimir
    if (activo) setTimeout(() => window.print(), 600);
  }, [activo]);

  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 print:hidden"
    >
      🖨 Imprimir
    </button>
  );
}
