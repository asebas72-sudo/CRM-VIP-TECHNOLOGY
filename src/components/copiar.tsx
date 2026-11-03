"use client";

import { useState } from "react";

/** Muestra un valor largo (ej. CUFE) con botón para copiarlo al portapapeles. */
export function ValorCopiable({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
    } catch {
      // Navegadores sin permiso de portapapeles: seleccionar el texto manualmente
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
      <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">{etiqueta}</span>
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-800 select-all" title={valor}>
        {valor}
      </code>
      <button
        type="button"
        onClick={copiar}
        className={`shrink-0 rounded-md px-3 py-1 text-xs font-semibold ${
          copiado ? "bg-green-600 text-white" : "bg-slate-900 text-white hover:bg-slate-700"
        }`}
      >
        {copiado ? "¡Copiado!" : "Copiar"}
      </button>
    </div>
  );
}
