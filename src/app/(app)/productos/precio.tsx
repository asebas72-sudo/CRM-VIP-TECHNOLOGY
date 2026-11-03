"use client";

import { useState, useTransition } from "react";
import { pesos } from "@/lib/formato";
import { margen } from "@/lib/precios";
import { actualizarPrecio } from "./acciones";

export function EditorPrecio({
  productoId,
  precio,
  costo,
  iva,
}: {
  productoId: string;
  precio: number;
  costo: number;
  iva: number;
}) {
  const [valor, setValor] = useState(String(Math.round(precio)));
  const [guardado, setGuardado] = useState(Math.round(precio));
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();

  const numero = Number(valor.replace(/\D/g, "")) || 0;
  const m = margen(numero, costo, iva);
  const cambiado = numero !== guardado;

  function guardar() {
    setError(undefined);
    iniciar(async () => {
      const r = await actualizarPrecio(productoId, numero);
      if (r.error) setError(r.error);
      else setGuardado(numero);
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <span
        className={`w-14 text-right text-xs tabular-nums ${
          m === null ? "text-slate-400" : m < 0 ? "font-semibold text-red-600" : m < 10 ? "text-amber-600" : "text-green-700"
        }`}
        title="Margen sobre el costo"
      >
        {m === null ? "—" : `${m.toFixed(0)}%`}
      </span>
      <input
        value={valor}
        inputMode="numeric"
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && cambiado && guardar()}
        aria-label="Precio de venta"
        title={error ?? pesos(numero)}
        className={`w-28 rounded-md border px-2 py-1 text-right tabular-nums ${
          error ? "border-red-500" : cambiado ? "border-blue-500 bg-blue-50" : "border-slate-300"
        }`}
      />
      <button
        onClick={guardar}
        disabled={!cambiado || guardando}
        className="w-16 rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
      >
        {guardando ? "..." : cambiado ? "Guardar" : "✓"}
      </button>
    </div>
  );
}
