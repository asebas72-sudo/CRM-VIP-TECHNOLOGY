"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { fecha, pesos } from "@/lib/formato";
import { detalleFacturaCorreo, type DetalleFactura } from "./acciones";

export type FacturaFila = {
  id: string;
  numero: string | null;
  fecha_documento: string | null;
  proveedor_nombre: string | null;
  proveedor_nit: string | null;
  monto: number | null;
  compra_id: string | null;
};

/** Solo dígitos y sin dígito de verificación, para comparar NIT escritos de formas distintas. */
function nitBase(nit: string | null | undefined): string {
  const limpio = (nit ?? "").split("-")[0].replace(/\D/g, "");
  return limpio;
}

/** Una factura del correo: al abrirla muestra lo comprado y a quién se facturó. */
export function FilaFactura({ f, empresa }: { f: FacturaFila; empresa: { nombre: string; nit: string | null } }) {
  const [estado, setEstado] = useState<{ cargando?: boolean; error?: string; detalle?: DetalleFactura }>({});

  async function alAbrir(abierta: boolean) {
    if (!abierta || estado.detalle || estado.cargando) return;
    setEstado({ cargando: true });
    setEstado(await detalleFacturaCorreo(f.id));
  }

  const d = estado.detalle;
  const nitEmpresa = nitBase(empresa.nit);
  const nitCliente = nitBase(d?.cliente.nit);
  const otraEmpresa = d && nitEmpresa && nitCliente && !nitCliente.startsWith(nitEmpresa) && !nitEmpresa.startsWith(nitCliente);

  return (
    <details className="group rounded-2xl bg-white ring-1 ring-slate-200" onToggle={(e) => alAbrir(e.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 hover:bg-slate-50">
        <ChevronRight className="size-4 shrink-0 text-slate-400 transition group-open:rotate-90" aria-hidden />
        <span className="w-24 text-sm text-slate-600">{f.fecha_documento ? fecha(f.fecha_documento) : "—"}</span>
        <span className="min-w-56 flex-1">
          <span className="block font-medium text-slate-900">{f.proveedor_nombre}</span>
          <span className="text-xs text-slate-500">
            Factura {f.numero ?? "—"}
            {f.proveedor_nit && ` · NIT ${f.proveedor_nit}`}
          </span>
        </span>
        <span className="w-32 text-right font-semibold tabular-nums">{pesos(f.monto)}</span>
        <span className="w-44 text-right">
          {f.compra_id ? (
            <Link
              href={`/compras/${f.compra_id}`}
              className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 hover:underline"
            >
              ✓ En Compras
            </Link>
          ) : (
            <Link
              href={`/compras/importar?correo=${f.id}`}
              className="inline-block rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Cargar al inventario
            </Link>
          )}
        </span>
      </summary>

      <div className="border-t border-slate-100 px-4 py-4">
        {estado.cargando && <p className="text-sm text-slate-500">Leyendo la factura…</p>}
        {estado.error && <p className="text-sm text-red-700">No se pudo leer el detalle: {estado.error}</p>}
        {d && (
          <div className="space-y-3">
            <div
              className={`rounded-lg px-3 py-2 text-sm ${otraEmpresa ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200" : "bg-slate-50 text-slate-700"}`}
            >
              <span className="text-slate-500">Facturada a: </span>
              <strong>{d.cliente.nombre || "—"}</strong>
              {d.cliente.nit && <span> · NIT {d.cliente.nit}</span>}
              {otraEmpresa && (
                <span className="mt-1 block font-medium">
                  Ojo: el NIT del comprador no coincide con {empresa.nombre}
                  {empresa.nit ? ` (NIT ${empresa.nit})` : ""}. Revise si corresponde a esta empresa.
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="py-2 pr-3 font-medium">Código</th>
                    <th className="py-2 pr-3 font-medium">Descripción</th>
                    <th className="py-2 pr-3 text-right font-medium">Cant.</th>
                    <th className="py-2 pr-3 text-right font-medium">Costo unit.</th>
                    <th className="py-2 pr-3 text-right font-medium">IVA</th>
                    <th className="py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {d.lineas.map((l) => (
                    <tr key={l.linea} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-2 pr-3 font-mono text-xs text-slate-500">{l.codigo || "—"}</td>
                      <td className="py-2 pr-3 text-slate-800">
                        {l.descripcion}
                        {l.seriales > 0 && <span className="ml-2 text-xs text-slate-500">({l.seriales} seriales)</span>}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{l.cantidad}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{pesos(l.costoUnitario)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-slate-500">{l.ivaPorcentaje}%</td>
                      <td className="py-2 text-right font-medium tabular-nums">{pesos(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="text-sm">
                  <tr>
                    <td colSpan={5} className="pt-3 pr-3 text-right text-slate-500">Subtotal</td>
                    <td className="pt-3 text-right tabular-nums">{pesos(d.subtotal)}</td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="pr-3 text-right text-slate-500">IVA</td>
                    <td className="text-right tabular-nums">{pesos(d.iva)}</td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="pr-3 text-right font-semibold">Total</td>
                    <td className="text-right font-bold tabular-nums">{pesos(d.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
