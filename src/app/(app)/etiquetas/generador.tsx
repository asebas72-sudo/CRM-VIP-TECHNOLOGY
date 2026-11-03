"use client";

import { useMemo, useState } from "react";
import { CodigoQR } from "@/components/codigo-qr";
import { botonPrimario } from "@/components/dialogo";
import { pesos } from "@/lib/formato";

export type ProductoEtiqueta = { id: string; codigo: string; nombre: string; precio_venta: number; stock: number };

type Formato = {
  id: string;
  texto: string;
  /** Reglas de impresión (@page y tamaño de cada etiqueta) */
  css: string;
  ancho: string;
  alto: string;
  qr: string;
};

const FORMATOS: Formato[] = [
  {
    id: "rollo-50x25",
    texto: "Rollo térmico 50 × 25 mm",
    ancho: "50mm",
    alto: "25mm",
    qr: "21mm",
    css: `@page { size: 50mm 25mm; margin: 0 } .hoja-etiquetas { display: block !important } .etiqueta { break-after: page }`,
  },
  {
    id: "rollo-60x40",
    texto: "Rollo térmico 60 × 40 mm",
    ancho: "60mm",
    alto: "40mm",
    qr: "28mm",
    css: `@page { size: 60mm 40mm; margin: 0 } .hoja-etiquetas { display: block !important } .etiqueta { break-after: page }`,
  },
  {
    id: "carta-3x10",
    texto: "Hoja carta adhesiva 3 × 10 (30 por hoja)",
    ancho: "66.7mm",
    alto: "25.4mm",
    qr: "21mm",
    css: `@page { size: letter; margin: 12.7mm 4.8mm } .hoja-etiquetas { display: grid !important; grid-template-columns: repeat(3, 66.7mm); column-gap: 3.2mm }`,
  },
];

export function GeneradorEtiquetas({
  productos,
  preseleccion,
}: {
  productos: ProductoEtiqueta[];
  preseleccion: Record<string, number>;
}) {
  const [cantidades, setCantidades] = useState<Record<string, number>>(preseleccion);
  const [busqueda, setBusqueda] = useState("");
  const [formatoId, setFormatoId] = useState(FORMATOS[0].id);
  const [conPrecio, setConPrecio] = useState(true);
  const formato = FORMATOS.find((f) => f.id === formatoId)!;

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter((p) => p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q));
  }, [productos, busqueda]);

  const etiquetas = productos.flatMap((p) => Array.from({ length: cantidades[p.id] ?? 0 }, () => p));
  const total = etiquetas.length;

  const fijar = (id: string, n: number) =>
    setCantidades((actual) => {
      const copia = { ...actual };
      if (n > 0) copia[id] = Math.min(n, 999);
      else delete copia[id];
      return copia;
    });

  return (
    <>
      <style>{`@media print { ${formato.css} }`}</style>

      <div className="grid gap-6 print:hidden lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar producto..."
              className="min-w-56 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
            <button
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              onClick={() => visibles.forEach((p) => fijar(p.id, Math.max(Math.round(p.stock), 1)))}
            >
              Todos según stock
            </button>
            <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" onClick={() => setCantidades({})}>
              Limpiar
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto rounded-2xl bg-white ring-1 ring-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-2 font-medium">Producto</th>
                  <th className="px-4 py-2 text-right font-medium">Precio</th>
                  <th className="px-4 py-2 text-right font-medium">Stock</th>
                  <th className="px-4 py-2 text-right font-medium">Etiquetas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibles.map((p) => (
                  <tr key={p.id} className={cantidades[p.id] ? "bg-blue-50/50" : ""}>
                    <td className="px-4 py-1.5">
                      <p className="text-slate-900">{p.nombre}</p>
                      <p className="font-mono text-xs text-slate-500">{p.codigo}</p>
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{pesos(p.precio_venta)}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{p.stock}</td>
                    <td className="px-4 py-1.5 text-right">
                      <input
                        type="number"
                        min={0}
                        value={cantidades[p.id] ?? ""}
                        placeholder="0"
                        onChange={(e) => fijar(p.id, Number(e.target.value))}
                        aria-label={`Etiquetas de ${p.nombre}`}
                        className="w-20 rounded-md border border-slate-300 px-2 py-1 text-right"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4 self-start rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <label className="block text-sm font-medium text-slate-700">
            Formato
            <select
              value={formatoId}
              onChange={(e) => setFormatoId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {FORMATOS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.texto}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={conPrecio} onChange={(e) => setConPrecio(e.target.checked)} />
            Mostrar precio en la etiqueta
          </label>
          <p className="text-sm text-slate-600">
            <strong>{total}</strong> etiqueta(s) de {Object.keys(cantidades).length} producto(s).
          </p>
          <button className={`${botonPrimario} w-full py-2.5`} disabled={total === 0} onClick={() => window.print()}>
            Imprimir etiquetas
          </button>
          <p className="text-xs text-slate-500">
            En la ventana de impresión elija su impresora de etiquetas, tamaño de papel igual al formato y márgenes
            &quot;Ninguno&quot;. También puede guardar como PDF.
          </p>
          {total > 0 && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Vista previa</p>
              <div className="origin-top-left rounded-md border border-dashed border-slate-300 p-2">
                <Etiqueta producto={etiquetas[0]} formato={formato} conPrecio={conPrecio} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Solo se ve al imprimir */}
      <div className="hoja-etiquetas hidden">
        {etiquetas.map((p, i) => (
          <Etiqueta key={i} producto={p} formato={formato} conPrecio={conPrecio} />
        ))}
      </div>
    </>
  );
}

function Etiqueta({ producto, formato, conPrecio }: { producto: ProductoEtiqueta; formato: Formato; conPrecio: boolean }) {
  return (
    <div
      className="etiqueta flex items-center gap-[1.5mm] overflow-hidden bg-white p-[1.5mm] text-black"
      style={{ width: formato.ancho, height: formato.alto }}
    >
      <div className="shrink-0">
        <CodigoQR valor={producto.codigo} tamano={formato.qr} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between self-stretch py-[0.5mm]">
        <p className="line-clamp-3 text-[7pt] leading-tight font-semibold">{producto.nombre}</p>
        {conPrecio && <p className="text-[12pt] leading-none font-bold">{pesos(producto.precio_venta)}</p>}
        <p className="truncate font-mono text-[6pt] leading-none">{producto.codigo}</p>
      </div>
    </div>
  );
}
