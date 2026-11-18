"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { botonPrimario, botonSecundario } from "@/components/dialogo";
import { pesos } from "@/lib/formato";
import { editarCompra } from "../acciones";

export type LineaEditable = {
  id: string;
  nombre: string;
  codigo: string;
  cantidad: number;
  costo_unitario: number;
  iva_porcentaje: number;
  tieneSeriales: boolean;
};

type Linea = LineaEditable & { quitar: boolean; cantidadOriginal: number };

const campo =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20";

const soloNumero = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0;
const conMiles = (n: number) => (n ? n.toLocaleString("es-CO", { maximumFractionDigits: 2 }) : "");

export function EditorCompra({
  compraId,
  proveedores,
  cabecera,
  lineas: iniciales,
}: {
  compraId: string;
  proveedores: { id: string; nombre: string; nit: string | null }[];
  cabecera: { proveedor_id: string; numero_factura: string; fecha: string; es_inversion: boolean };
  lineas: LineaEditable[];
}) {
  const [proveedor, setProveedor] = useState(cabecera.proveedor_id);
  const [numero, setNumero] = useState(cabecera.numero_factura);
  const [fecha, setFecha] = useState(cabecera.fecha);
  const [esInversion, setEsInversion] = useState(cabecera.es_inversion);
  const [lineas, setLineas] = useState<Linea[]>(
    iniciales.map((l) => ({ ...l, quitar: false, cantidadOriginal: l.cantidad })),
  );
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();

  const cambiar = (id: string, datos: Partial<Linea>) =>
    setLineas((ls) => ls.map((l) => (l.id === id ? { ...l, ...datos } : l)));

  const vigentes = lineas.filter((l) => !l.quitar);
  const subtotal = vigentes.reduce((s, l) => s + l.cantidad * l.costo_unitario, 0);
  const iva = vigentes.reduce((s, l) => s + (l.cantidad * l.costo_unitario * l.iva_porcentaje) / 100, 0);

  function guardar() {
    setError(undefined);
    if (vigentes.length === 0) return setError("La compra debe quedar con al menos un producto.");
    if (vigentes.some((l) => !(l.cantidad > 0))) return setError("Revise las cantidades: deben ser mayores a 0.");
    iniciar(async () => {
      const r = await editarCompra(compraId, {
        proveedor_id: proveedor,
        numero_factura: numero.trim(),
        fecha,
        es_inversion: esInversion,
        items: lineas.map((l) => ({
          id: l.id,
          cantidad: l.cantidad,
          costo_unitario: l.costo_unitario,
          iva_porcentaje: l.iva_porcentaje,
          quitar: l.quitar,
        })),
      });
      // Si sale bien, la acción vuelve al detalle de la compra
      if (r?.error) setError(r.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:grid-cols-3">
        <label className="block text-sm font-medium text-slate-700">
          Proveedor
          <select value={proveedor} onChange={(e) => setProveedor(e.target.value)} className={`mt-1 ${campo}`}>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
                {p.nit ? ` · ${p.nit}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Número de factura
          <input value={numero} onChange={(e) => setNumero(e.target.value)} className={`mt-1 ${campo}`} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`mt-1 ${campo}`} />
        </label>
      </div>

      <label
        className={`flex cursor-pointer items-start gap-3 rounded-2xl p-4 ring-1 ${
          esInversion ? "bg-violet-50 ring-violet-300" : "bg-white ring-slate-200"
        }`}
      >
        <input
          type="checkbox"
          checked={esInversion}
          onChange={(e) => setEsInversion(e.target.checked)}
          className="mt-1 h-4 w-4 accent-violet-700"
        />
        <span>
          <span className="block font-semibold text-slate-900">Es inversión inicial</span>
          <span className="block text-sm text-slate-600">
            Mercancía comprada con el capital de los socios para arrancar. En Informes se muestra aparte y no se resta de lo
            que entró por ventas. El inventario no cambia.
          </span>
        </span>
      </label>

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="w-28 px-4 py-3 font-medium">Cant.</th>
              <th className="w-40 px-4 py-3 font-medium">Costo u. (sin IVA)</th>
              <th className="w-24 px-4 py-3 font-medium">IVA %</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 align-top">
            {lineas.map((l) => {
              const total = l.cantidad * l.costo_unitario * (1 + l.iva_porcentaje / 100);
              const dif = (l.quitar ? 0 : l.cantidad) - l.cantidadOriginal;
              return (
                <tr key={l.id} className={l.quitar ? "bg-red-50/60 text-slate-400" : ""}>
                  <td className="px-4 py-3">
                    <p className={`font-medium ${l.quitar ? "line-through" : "text-slate-900"}`}>{l.nombre}</p>
                    <p className="font-mono text-xs text-slate-500">{l.codigo}</p>
                    {l.tieneSeriales && (
                      <p className="text-xs text-amber-700">Tiene seriales: solo se puede cambiar costo e IVA.</p>
                    )}
                    {dif !== 0 && (
                      <p className={`text-xs font-medium ${dif > 0 ? "text-green-700" : "text-red-600"}`}>
                        Inventario: {dif > 0 ? "+" : "−"}
                        {Math.abs(dif).toLocaleString("es-CO")} unidad(es)
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      inputMode="decimal"
                      disabled={l.quitar || l.tieneSeriales}
                      value={l.cantidad ? String(l.cantidad).replace(".", ",") : ""}
                      onChange={(e) => cambiar(l.id, { cantidad: soloNumero(e.target.value) })}
                      className={`${campo} text-right tabular-nums disabled:bg-slate-100`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      inputMode="numeric"
                      disabled={l.quitar}
                      value={conMiles(l.costo_unitario)}
                      onChange={(e) => cambiar(l.id, { costo_unitario: soloNumero(e.target.value) })}
                      className={`${campo} text-right tabular-nums disabled:bg-slate-100`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      inputMode="decimal"
                      disabled={l.quitar}
                      value={String(l.iva_porcentaje)}
                      onChange={(e) => cambiar(l.id, { iva_porcentaje: soloNumero(e.target.value) })}
                      className={`${campo} text-right tabular-nums disabled:bg-slate-100`}
                    />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{l.quitar ? "—" : pesos(total)}</td>
                  <td className="px-4 py-3 text-right">
                    {!l.tieneSeriales && (
                      <button
                        type="button"
                        onClick={() => cambiar(l.id, { quitar: !l.quitar })}
                        className={`text-sm font-medium ${l.quitar ? "text-blue-700" : "text-red-600"} hover:underline`}
                      >
                        {l.quitar ? "Restaurar" : "Quitar"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-slate-200 text-slate-900">
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right text-slate-500">Subtotal</td>
              <td className="px-4 py-2 text-right tabular-nums">{pesos(subtotal)}</td>
              <td />
            </tr>
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right text-slate-500">IVA</td>
              <td className="px-4 py-2 text-right tabular-nums">{pesos(iva)}</td>
              <td />
            </tr>
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right font-semibold">Total</td>
              <td className="px-4 py-2 text-right font-semibold tabular-nums">{pesos(subtotal + iva)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <p className="mr-auto text-sm text-slate-500">
          Al guardar se ajusta el inventario con la diferencia y se recalcula el costo promedio.
        </p>
        <Link href={`/compras/${compraId}`} className={botonSecundario}>
          Cancelar
        </Link>
        <button type="button" onClick={guardar} disabled={guardando} className={botonPrimario}>
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
