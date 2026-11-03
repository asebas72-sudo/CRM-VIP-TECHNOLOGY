"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { cantidad, fecha, pesos } from "@/lib/formato";
import {
  analizarFactura,
  importarCompra,
  type EdicionLinea,
  type EstadoAnalisis,
  type VistaPrevia,
} from "./acciones";

const campo =
  "w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20";

export function Importador() {
  const [estado, analizar, analizando] = useActionState<EstadoAnalisis, FormData>(analizarFactura, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [, iniciarAnalisis] = useTransition();

  return (
    <div className="space-y-6">
      <form
        ref={formRef}
        // onSubmit en vez de action: así React no limpia los archivos
        // elegidos, que se vuelven a enviar al confirmar la importación.
        onSubmit={(e) => {
          e.preventDefault();
          const datos = new FormData(e.currentTarget);
          iniciarAnalisis(() => analizar(datos));
        }}
        className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <label className="block text-sm font-medium text-slate-700">
          Factura XML (obligatorio)
          <input
            name="xml"
            type="file"
            accept=".xml,text/xml,application/xml"
            required
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-white"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          PDF de la factura (opcional)
          <input
            name="pdf"
            type="file"
            accept=".pdf,application/pdf"
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-200 file:px-3 file:py-1.5"
          />
        </label>
        <button
          disabled={analizando}
          className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {analizando ? "Leyendo..." : "Leer factura"}
        </button>
      </form>

      {estado.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{estado.error}</p>}
      {estado.vista && (
        // key: al leer otra factura se reinician las ediciones
        <VistaPreviaCompra
          key={`${estado.vista.factura.proveedor.nit}-${estado.vista.factura.numero}`}
          vista={estado.vista}
          formulario={formRef}
        />
      )}
    </div>
  );
}

function VistaPreviaCompra({
  vista,
  formulario,
}: {
  vista: VistaPrevia;
  formulario: React.RefObject<HTMLFormElement | null>;
}) {
  const { factura, lineas, catalogo } = vista;
  const porCodigo = useMemo(() => new Map(catalogo.map((p) => [p.codigo, p])), [catalogo]);
  const [ediciones, setEdiciones] = useState<EdicionLinea[]>(() =>
    lineas.map((l) => ({
      codigo: l.codigoSugerido,
      nombre: l.descripcion,
      manejaSerial: l.seriales.length > 0,
    })),
  );
  const [error, setError] = useState<string>();
  const [importando, iniciar] = useTransition();

  const editar = (i: number, cambio: Partial<EdicionLinea>) =>
    setEdiciones((actual) => actual.map((e, j) => (j === i ? { ...e, ...cambio } : e)));

  // Códigos nuevos repetidos dentro de la misma factura se crean una sola vez
  const nuevos = new Set(ediciones.filter((e) => e.codigo && !porCodigo.has(e.codigo.trim())).map((e) => e.codigo.trim()));
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
  const seriales = lineas.reduce((s, l, i) => s + (ediciones[i].manejaSerial ? l.seriales.length : 0), 0);

  function importar() {
    const form = formulario.current;
    if (!form) return;
    setError(undefined);
    const datos = new FormData(form);
    datos.set("ediciones", JSON.stringify(ediciones));
    iniciar(async () => {
      const resultado = await importarCompra(datos);
      if (resultado?.error) setError(resultado.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:grid-cols-4">
        <Dato titulo="Proveedor" valor={factura.proveedor.nombre} detalle={`NIT ${factura.proveedor.nit}${vista.proveedorNuevo ? " · nuevo" : ""}`} />
        <Dato titulo="Factura" valor={factura.numero} detalle={fecha(factura.fecha)} />
        <Dato titulo="Unidades" valor={cantidad(unidades)} detalle={`${lineas.length} líneas · ${seriales} seriales`} />
        <Dato titulo="Total" valor={pesos(factura.total)} detalle={`Subtotal ${pesos(factura.subtotal)} + IVA ${pesos(factura.iva)}`} />
      </div>

      {vista.duplicada && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Esta factura ya fue importada. No se puede cargar dos veces.
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">En la factura</th>
              <th className="px-3 py-2 text-right font-medium">Cant.</th>
              <th className="px-3 py-2 text-right font-medium">Costo u. (sin IVA)</th>
              <th className="w-[38%] px-3 py-2 font-medium">Producto en inventario</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 align-top">
            {lineas.map((l, i) => {
              const ed = ediciones[i];
              const existente = porCodigo.get(ed.codigo.trim());
              return (
                <tr key={i}>
                  <td className="px-3 py-2">
                    <p className="text-slate-900">{l.descripcion}</p>
                    <p className="text-xs text-slate-500">
                      Cód. proveedor {l.codigoProveedor || "—"} · IVA {l.ivaPorcentaje}%
                      {l.seriales.length > 0 && ` · ${l.seriales.length} serial(es)`}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{cantidad(l.cantidad)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pesos(l.costoUnitario)}</td>
                  <td className="space-y-1.5 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={ed.codigo}
                        onChange={(e) => editar(i, { codigo: e.target.value })}
                        list="catalogo-productos"
                        className={`${campo} font-mono`}
                        aria-label="Código del producto"
                      />
                      {existente ? (
                        <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                          Existente
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                          Nuevo
                        </span>
                      )}
                    </div>
                    {existente ? (
                      <p className="text-xs text-slate-600">
                        {existente.nombre} · stock actual {cantidad(existente.stock)}
                        {l.origen === "proveedor" && " · reconocido por el código del proveedor"}
                      </p>
                    ) : (
                      <>
                        <input
                          value={ed.nombre}
                          onChange={(e) => editar(i, { nombre: e.target.value })}
                          className={campo}
                          aria-label="Nombre del producto nuevo"
                        />
                        <label className="flex items-center gap-2 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={ed.manejaSerial}
                            onChange={(e) => editar(i, { manejaSerial: e.target.checked })}
                          />
                          Maneja serial (se pide al vender)
                        </label>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <datalist id="catalogo-productos">
          {catalogo.map((p) => (
            <option key={p.id} value={p.codigo}>
              {p.nombre}
            </option>
          ))}
        </datalist>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <p className="text-sm text-slate-600">
          Se crearán <strong>{nuevos.size}</strong> producto(s) nuevo(s) con precio sugerido (costo + IVA + margen).
          Escriba el código de un producto existente para sumarle el stock.
        </p>
        <button
          onClick={importar}
          disabled={importando || vista.duplicada}
          className="rounded-lg bg-green-600 px-5 py-2.5 font-semibold text-white hover:bg-green-700 disabled:opacity-60"
        >
          {importando ? "Importando..." : "Importar compra al inventario"}
        </button>
      </div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}

function Dato({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="truncate font-semibold text-slate-900">{valor}</p>
      {detalle && <p className="text-xs text-slate-500">{detalle}</p>}
    </div>
  );
}
