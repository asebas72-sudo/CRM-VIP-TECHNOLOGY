"use client";

import { useRef, useState, useTransition } from "react";
import { buscarClientes, type ClienteVenta } from "./acciones";

export type SeleccionCliente =
  | { tipo: "generico" }
  | { tipo: "existente"; cliente: ClienteVenta }
  | { tipo: "nuevo"; documento: string; nombre: string; telefono: string };

const campo = "w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm";

/** Cliente de la venta: siempre hay uno (por defecto CONSUMIDOR FINAL). */
export function SelectorCliente({
  valor,
  alCambiar,
  requiereIdentificado,
}: {
  valor: SeleccionCliente;
  alCambiar: (v: SeleccionCliente) => void;
  requiereIdentificado: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ClienteVenta[]>([]);
  const [, iniciar] = useTransition();
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);

  function buscar(q: string) {
    setTexto(q);
    clearTimeout(temporizador.current);
    if (q.trim().length < 2) {
      setResultados([]);
      return;
    }
    temporizador.current = setTimeout(() => iniciar(async () => setResultados(await buscarClientes(q))), 300);
  }

  const alerta = requiereIdentificado && valor.tipo === "generico";

  return (
    <div className={`space-y-2 rounded-xl p-3 ring-1 ${alerta ? "bg-amber-50 ring-amber-300" : "bg-slate-50 ring-slate-200"}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">Cliente</p>
        {valor.tipo !== "generico" && (
          <button onClick={() => alCambiar({ tipo: "generico" })} className="text-xs text-slate-500 hover:text-red-600">
            Quitar
          </button>
        )}
      </div>

      {valor.tipo === "generico" && (
        <>
          <p className="text-sm text-slate-900">CONSUMIDOR FINAL</p>
          {alerta && <p className="text-xs text-amber-800">Para crédito o separado elija o cree un cliente.</p>}
          <div className="relative">
            <input
              value={texto}
              onChange={(e) => buscar(e.target.value)}
              placeholder="Buscar cliente por cédula o nombre..."
              className={campo}
            />
            {resultados.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg bg-white shadow-lg ring-1 ring-slate-200">
                {resultados.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      alCambiar({ tipo: "existente", cliente: c });
                      setTexto("");
                      setResultados([]);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                  >
                    {c.nombre} <span className="text-slate-500">{c.documento}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => alCambiar({ tipo: "nuevo", documento: texto.match(/^\d+$/) ? texto : "", nombre: texto.match(/^\d+$/) ? "" : texto, telefono: "" })}
            className="text-xs font-medium text-blue-700 hover:underline"
          >
            + Crear cliente nuevo
          </button>
        </>
      )}

      {valor.tipo === "existente" && (
        <p className="text-sm text-slate-900">
          {valor.cliente.nombre}
          <span className="block text-xs text-slate-500">
            {[valor.cliente.documento, valor.cliente.telefono].filter(Boolean).join(" · ")}
          </span>
        </p>
      )}

      {valor.tipo === "nuevo" && (
        <div className="space-y-2">
          <input
            value={valor.documento}
            onChange={(e) => alCambiar({ ...valor, documento: e.target.value })}
            placeholder="Cédula / NIT *"
            className={campo}
            autoFocus
          />
          <input
            value={valor.nombre}
            onChange={(e) => alCambiar({ ...valor, nombre: e.target.value })}
            placeholder="Nombre completo *"
            className={campo}
          />
          <input
            value={valor.telefono}
            onChange={(e) => alCambiar({ ...valor, telefono: e.target.value })}
            placeholder="Teléfono"
            className={campo}
          />
        </div>
      )}
    </div>
  );
}

export function clienteCompleto(c: SeleccionCliente): boolean {
  return c.tipo !== "nuevo" || (c.documento.trim() !== "" && c.nombre.trim() !== "");
}
