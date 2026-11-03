"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";

export type FirmaRef = { obtener: () => string | null; limpiar: () => void };

/** Recuadro para que el cliente firme con el dedo o el mouse. */
export function Firma({ ref }: { ref: Ref<FirmaRef> }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [vacia, setVacia] = useState(true);

  // Ajusta la resolución del lienzo a su tamaño en pantalla (nítido en celulares)
  useEffect(() => {
    const c = lienzo.current!;
    const escala = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * escala;
    c.height = c.offsetHeight * escala;
    const ctx = c.getContext("2d")!;
    ctx.scale(escala, escala);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
  }, []);

  function punto(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function limpiar() {
    const c = lienzo.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setVacia(true);
  }

  useImperativeHandle(ref, () => ({
    obtener: () => (vacia ? null : lienzo.current!.toDataURL("image/png")),
    limpiar,
  }));

  return (
    <div>
      <canvas
        ref={lienzo}
        className="h-40 w-full touch-none rounded-lg border-2 border-dashed border-slate-300 bg-white"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dibujando.current = true;
          const { x, y } = punto(e);
          const ctx = e.currentTarget.getContext("2d")!;
          ctx.beginPath();
          ctx.moveTo(x, y);
        }}
        onPointerMove={(e) => {
          if (!dibujando.current) return;
          const { x, y } = punto(e);
          const ctx = e.currentTarget.getContext("2d")!;
          ctx.lineTo(x, y);
          ctx.stroke();
          if (vacia) setVacia(false);
        }}
        onPointerUp={() => (dibujando.current = false)}
        onPointerCancel={() => (dibujando.current = false)}
        aria-label="Espacio para la firma del cliente"
      />
      <div className="mt-1 flex justify-between text-xs text-slate-500">
        <span>{vacia ? "Firme dentro del recuadro" : "Firma registrada"}</span>
        <button type="button" onClick={limpiar} className="font-medium text-blue-700 hover:underline">
          Limpiar firma
        </button>
      </div>
    </div>
  );
}
