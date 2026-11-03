"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { botonExito, botonPrimario, botonSecundario, Dialogo } from "@/components/dialogo";
import { pesos } from "@/lib/formato";
import { entregarVenta, registrarAbono, type DatosVenta } from "./acciones";

const FORMAS: { valor: DatosVenta["forma_pago"]; texto: string }[] = [
  { valor: "efectivo", texto: "Efectivo" },
  { valor: "tarjeta", texto: "Tarjeta" },
  { valor: "transferencia", texto: "Transferencia" },
];

type Resultado = { tono: "exito" | "error"; titulo: string; texto: string; ventaId?: string };

/** Botón + popup para registrar un abono a una venta con saldo. */
export function BotonAbonar({
  ventaId,
  consecutivo,
  cliente,
  saldo,
  compacto,
}: {
  ventaId: string;
  consecutivo: number;
  cliente: string;
  saldo: number;
  compacto?: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState("");
  const [forma, setForma] = useState<DatosVenta["forma_pago"]>("efectivo");
  const [nota, setNota] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [guardando, iniciar] = useTransition();

  const numero = Number(valor.replace(/\D/g, "")) || 0;

  function guardar() {
    iniciar(async () => {
      const r = await registrarAbono(ventaId, numero, forma, nota);
      setAbierto(false);
      if (r.error) {
        setResultado({ tono: "error", titulo: "No se pudo registrar el abono", texto: r.error });
      } else {
        setValor("");
        setNota("");
        setResultado({
          tono: "exito",
          titulo: "Abono registrado",
          texto:
            r.saldo === 0
              ? `La venta #${consecutivo} quedó totalmente pagada.`
              : `Abono de ${pesos(numero)}. Saldo pendiente: ${pesos(r.saldo ?? 0)}.`,
          ventaId,
        });
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className={compacto ? "rounded-md bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700" : botonExito}
      >
        Registrar abono
      </button>

      <Dialogo
        abierto={abierto}
        titulo={`Abono a la venta #${consecutivo}`}
        alCerrar={guardando ? undefined : () => setAbierto(false)}
        acciones={
          <>
            <button className={botonSecundario} onClick={() => setAbierto(false)} disabled={guardando}>
              Cancelar
            </button>
            <button className={botonExito} onClick={guardar} disabled={guardando || numero <= 0 || numero > saldo}>
              {guardando ? "Guardando..." : `Abonar ${pesos(numero)}`}
            </button>
          </>
        }
      >
        <p>
          {cliente} · saldo pendiente <strong className="text-red-600">{pesos(saldo)}</strong>
        </p>
        <div className="flex gap-2">
          <input
            value={numero ? numero.toLocaleString("es-CO") : ""}
            onChange={(e) => setValor(e.target.value)}
            inputMode="numeric"
            placeholder="Valor del abono"
            autoFocus
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-right text-lg tabular-nums"
          />
          <button className={botonSecundario} onClick={() => setValor(String(saldo))} type="button">
            Todo
          </button>
        </div>
        {numero > saldo && <p className="text-red-600">El abono no puede superar el saldo.</p>}
        <div className="flex gap-2">
          {FORMAS.map((f) => (
            <button
              key={f.valor}
              type="button"
              onClick={() => setForma(f.valor)}
              className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-semibold ${
                forma === f.valor ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {f.texto}
            </button>
          ))}
        </div>
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Nota (opcional)"
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5"
        />
      </Dialogo>

      <Dialogo
        abierto={resultado !== null}
        tono={resultado?.tono}
        titulo={resultado?.titulo ?? ""}
        alCerrar={() => setResultado(null)}
        acciones={
          <>
            {resultado?.ventaId && (
              <button className={botonSecundario} onClick={() => router.push(`/ventas/${resultado.ventaId}?imprimir=1`)}>
                Imprimir comprobante
              </button>
            )}
            <button className={botonPrimario} onClick={() => setResultado(null)}>
              Entendido
            </button>
          </>
        }
      >
        <p>{resultado?.texto}</p>
      </Dialogo>
    </>
  );
}

/** Marca como entregado un separado ya pagado. */
export function BotonEntregar({ ventaId, compacto }: { ventaId: string; compacto?: boolean }) {
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();

  return (
    <>
      <button
        onClick={() => setConfirmando(true)}
        className={compacto ? "rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white" : botonPrimario}
      >
        Entregar producto
      </button>
      <Dialogo
        abierto={confirmando}
        titulo="¿Entregar el producto al cliente?"
        alCerrar={() => setConfirmando(false)}
        acciones={
          <>
            <button className={botonSecundario} onClick={() => setConfirmando(false)}>
              Cancelar
            </button>
            <button
              className={botonPrimario}
              disabled={guardando}
              onClick={() =>
                iniciar(async () => {
                  const r = await entregarVenta(ventaId);
                  setConfirmando(false);
                  if (r.error) setError(r.error);
                })
              }
            >
              {guardando ? "Guardando..." : "Sí, entregado"}
            </button>
          </>
        }
      >
        <p>El separado ya está pagado. Quedará registrado como entregado hoy.</p>
      </Dialogo>
      <Dialogo
        abierto={Boolean(error)}
        tono="error"
        titulo="No se pudo entregar"
        alCerrar={() => setError(undefined)}
        acciones={
          <button className={botonPrimario} onClick={() => setError(undefined)}>
            Entendido
          </button>
        }
      >
        <p>{error}</p>
      </Dialogo>
    </>
  );
}
