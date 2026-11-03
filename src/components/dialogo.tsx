"use client";

import { useEffect, type ReactNode } from "react";

type Tono = "info" | "exito" | "error" | "advertencia";

const ESTILO: Record<Tono, { icono: string; color: string }> = {
  info: { icono: "?", color: "bg-blue-100 text-blue-700" },
  exito: { icono: "✓", color: "bg-green-100 text-green-700" },
  error: { icono: "!", color: "bg-red-100 text-red-700" },
  advertencia: { icono: "!", color: "bg-amber-100 text-amber-700" },
};

/** Ventana emergente (popup) para confirmaciones y mensajes de resultado. */
export function Dialogo({
  abierto,
  tono = "info",
  titulo,
  children,
  acciones,
  alCerrar,
}: {
  abierto: boolean;
  tono?: Tono;
  titulo: string;
  children?: ReactNode;
  acciones: ReactNode;
  alCerrar?: () => void;
}) {
  useEffect(() => {
    if (!abierto || !alCerrar) return;
    const teclado = (e: KeyboardEvent) => e.key === "Escape" && alCerrar();
    window.addEventListener("keydown", teclado);
    return () => window.removeEventListener("keydown", teclado);
  }, [abierto, alCerrar]);

  if (!abierto) return null;
  const estilo = ESTILO[tono];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={alCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialogo-titulo"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${estilo.color}`}
            aria-hidden
          >
            {estilo.icono}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="dialogo-titulo" className="text-lg font-semibold text-slate-900">
              {titulo}
            </h2>
            {children && <div className="mt-2 space-y-2 text-sm text-slate-600">{children}</div>}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">{acciones}</div>
      </div>
    </div>
  );
}

export const botonPrimario =
  "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60";
export const botonExito =
  "rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60";
export const botonSecundario =
  "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";
