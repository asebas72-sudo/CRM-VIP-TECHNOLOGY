"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { botonPrimario, botonSecundario, Dialogo } from "@/components/dialogo";
import { anularVenta } from "../acciones";

export function AccionesVenta({
  ventaId,
  consecutivo,
  puedeAnular,
  imprimirAlAbrir,
}: {
  ventaId: string;
  consecutivo: number;
  puedeAnular: boolean;
  imprimirAlAbrir: boolean;
}) {
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string>();
  const [procesando, iniciar] = useTransition();

  // Viene del punto de venta con ?imprimir=1: abre la impresión de una vez
  useEffect(() => {
    if (imprimirAlAbrir) window.print();
  }, [imprimirAlAbrir]);

  function anular() {
    iniciar(async () => {
      const r = await anularVenta(ventaId, motivo);
      setAnulando(false);
      if (r.error) setError(r.error);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/ventas" className={botonSecundario}>
        Nueva venta
      </Link>
      <button className={botonPrimario} onClick={() => window.print()}>
        Imprimir tirilla
      </button>
      {puedeAnular && (
        <button
          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
          onClick={() => setAnulando(true)}
        >
          Anular venta
        </button>
      )}

      <Dialogo
        abierto={anulando}
        tono="advertencia"
        titulo={`¿Anular la venta #${consecutivo}?`}
        alCerrar={procesando ? undefined : () => setAnulando(false)}
        acciones={
          <>
            <button className={botonSecundario} onClick={() => setAnulando(false)} disabled={procesando}>
              Cancelar
            </button>
            <button
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              onClick={anular}
              disabled={procesando || !motivo.trim()}
            >
              {procesando ? "Anulando..." : "Sí, anular"}
            </button>
          </>
        }
      >
        <p>Los productos vuelven al inventario y los seriales quedan disponibles.</p>
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo de la anulación"
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          autoFocus
        />
      </Dialogo>
      <Dialogo
        abierto={Boolean(error)}
        tono="error"
        titulo="No se pudo anular"
        alCerrar={() => setError(undefined)}
        acciones={
          <button className={botonPrimario} onClick={() => setError(undefined)}>
            Entendido
          </button>
        }
      >
        <p>{error}</p>
      </Dialogo>
    </div>
  );
}
