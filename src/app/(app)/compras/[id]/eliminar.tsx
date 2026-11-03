"use client";

import { useState, useTransition } from "react";
import { botonSecundario, Dialogo } from "@/components/dialogo";
import { eliminarCompra } from "./acciones";

const botonPeligro =
  "rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60";

export function EliminarCompra({ compraId, numero, empresa }: { compraId: string; numero: string; empresa: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string>();
  const [eliminando, iniciar] = useTransition();

  function eliminar() {
    iniciar(async () => {
      const r = await eliminarCompra(compraId);
      // Si sale bien, la acción redirige al listado de compras
      setConfirmando(false);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <>
      <button
        onClick={() => setConfirmando(true)}
        className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
      >
        Eliminar compra
      </button>

      <Dialogo
        abierto={confirmando}
        tono="advertencia"
        titulo="¿Eliminar esta compra?"
        alCerrar={eliminando ? undefined : () => setConfirmando(false)}
        acciones={
          <>
            <button className={botonSecundario} onClick={() => setConfirmando(false)} disabled={eliminando}>
              Cancelar
            </button>
            <button className={botonPeligro} onClick={eliminar} disabled={eliminando}>
              {eliminando ? "Eliminando..." : "Sí, eliminar"}
            </button>
          </>
        }
      >
        <p>
          Se eliminará la factura <strong>{numero}</strong> de <strong>{empresa}</strong>: se restan sus unidades del
          inventario, se borran sus seriales y los productos que solo existían por esta factura.
        </p>
        <p>Esta acción no se puede deshacer. Luego puede volver a importar el XML en la empresa correcta.</p>
      </Dialogo>

      <Dialogo
        abierto={Boolean(error)}
        tono="error"
        titulo="No se pudo eliminar la compra"
        alCerrar={() => setError(undefined)}
        acciones={
          <button className={botonSecundario} onClick={() => setError(undefined)}>
            Entendido
          </button>
        }
      >
        <p>{error}</p>
      </Dialogo>
    </>
  );
}
