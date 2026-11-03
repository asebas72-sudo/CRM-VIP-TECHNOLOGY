"use client";

import { useEffect, type ReactNode } from "react";

/** Ventana emergente amplia para ver detalles (tablas, listados). */
export function Modal({
  abierto,
  titulo,
  subtitulo,
  children,
  pie,
  alCerrar,
}: {
  abierto: boolean;
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
  pie?: ReactNode;
  alCerrar: () => void;
}) {
  useEffect(() => {
    if (!abierto) return;
    const teclado = (e: KeyboardEvent) => e.key === "Escape" && alCerrar();
    window.addEventListener("keydown", teclado);
    // Evita que la página de fondo se desplace mientras el modal está abierto
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", teclado);
      document.body.style.overflow = anterior;
    };
  }, [abierto, alCerrar]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={alCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="modal-titulo" className="text-lg font-semibold text-slate-900">
              {titulo}
            </h2>
            {subtitulo && <p className="text-sm text-slate-500">{subtitulo}</p>}
          </div>
          <button
            onClick={alCerrar}
            className="rounded-lg px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {pie && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-6 py-3">{pie}</div>}
      </div>
    </div>
  );
}
