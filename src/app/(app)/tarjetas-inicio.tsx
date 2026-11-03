"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { cantidad, pesos } from "@/lib/formato";

export type VentaHoy = {
  id: string;
  consecutivo: number;
  fecha: string;
  total: number;
  saldo: number;
  tipo: string;
  forma_pago: string;
  cliente: string;
};

export type ProductoInicio = {
  id: string;
  codigo: string;
  nombre: string;
  stock: number;
  stock_minimo: number;
  costo_promedio: number;
  precio_venta: number;
};

type Detalle = "ventas" | "productos" | "inventario" | "alertas";

const FORMA: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  mixto: "Mixto",
};

const enlacePie = "rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700";
const th = "px-4 py-2 font-medium";
const td = "px-4 py-2";

export function TarjetasInicio({
  ventas,
  productos,
  verCostos,
  puedeVender,
}: {
  ventas: VentaHoy[];
  productos: ProductoInicio[];
  verCostos: boolean;
  puedeVender: boolean;
}) {
  const [abierto, setAbierto] = useState<Detalle | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const cerrar = () => {
    setAbierto(null);
    setBusqueda("");
  };

  const alertas = useMemo(
    () =>
      productos
        .filter((p) => p.stock <= 0 || (p.stock_minimo > 0 && p.stock <= p.stock_minimo))
        .sort((a, b) => a.stock - b.stock),
    [productos],
  );
  const porValor = useMemo(
    () =>
      productos
        .filter((p) => p.stock > 0)
        .map((p) => ({ ...p, valor: p.stock * p.costo_promedio }))
        .sort((a, b) => b.valor - a.valor),
    [productos],
  );
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? productos.filter((p) => p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)) : productos;
  }, [productos, busqueda]);

  const totalVentas = ventas.reduce((s, v) => s + v.total, 0);
  const porCobrar = ventas.reduce((s, v) => s + v.saldo, 0);
  const unidades = productos.reduce((s, p) => s + Math.max(p.stock, 0), 0);
  const valorCosto = porValor.reduce((s, p) => s + p.valor, 0);
  const porForma = Object.entries(
    ventas
      .filter((v) => v.tipo === "contado")
      .reduce<Record<string, number>>((acc, v) => {
        acc[v.forma_pago] = (acc[v.forma_pago] ?? 0) + v.total;
        return acc;
      }, {}),
  );

  const tarjetas: { id: Detalle; titulo: string; valor: string; detalle?: string; alerta?: boolean }[] = [
    { id: "ventas", titulo: "Ventas de hoy", valor: pesos(totalVentas), detalle: `${ventas.length} venta(s)` },
    { id: "productos", titulo: "Productos activos", valor: String(productos.length) },
    {
      id: "inventario",
      titulo: "Unidades en inventario",
      valor: cantidad(unidades),
      detalle: verCostos ? `Al costo ${pesos(valorCosto)}` : undefined,
    },
    {
      id: "alertas",
      titulo: "Alertas de stock",
      valor: String(alertas.length),
      detalle: "Sin existencias o bajo mínimo",
      alerta: alertas.length > 0,
    },
  ];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map((t) => (
          <button
            key={t.id}
            onClick={() => setAbierto(t.id)}
            className="group rounded-2xl bg-white p-5 text-left ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-blue-300 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
          >
            <p className="flex items-center justify-between text-sm text-slate-500">
              {t.titulo}
              <span className="text-xs text-blue-600 opacity-0 transition group-hover:opacity-100">Ver detalle →</span>
            </p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${t.alerta ? "text-red-600" : "text-slate-900"}`}>{t.valor}</p>
            {t.detalle && <p className="text-xs text-slate-500">{t.detalle}</p>}
          </button>
        ))}
      </div>

      {/* Ventas de hoy */}
      <Modal
        abierto={abierto === "ventas"}
        titulo="Ventas de hoy"
        subtitulo={`${ventas.length} venta(s) · ${pesos(totalVentas)}${porCobrar > 0 ? ` · por cobrar ${pesos(porCobrar)}` : ""}`}
        alCerrar={cerrar}
        pie={
          <>
            {puedeVender && (
              <Link href="/ventas" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Nueva venta
              </Link>
            )}
            <Link href="/ventas/historial" className={enlacePie}>
              Ver historial completo
            </Link>
          </>
        }
      >
        {porForma.length > 0 && (
          <div className="flex flex-wrap gap-2 px-6 pt-4">
            {porForma.map(([forma, valor]) => (
              <span key={forma} className="rounded-full bg-slate-100 px-3 py-1 text-sm">
                {FORMA[forma] ?? forma}: <strong className="tabular-nums">{pesos(valor)}</strong>
              </span>
            ))}
          </div>
        )}
        <Tabla vacia={ventas.length === 0} mensaje="Aún no hay ventas hoy.">
          <thead className="sticky top-0 bg-slate-50 text-slate-600">
            <tr>
              <th className={th}>No.</th>
              <th className={th}>Hora</th>
              <th className={th}>Cliente</th>
              <th className={th}>Tipo / pago</th>
              <th className={`${th} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ventas.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50">
                <td className={td}>
                  <Link href={`/ventas/${v.id}`} className="font-semibold text-blue-700 hover:underline">
                    #{v.consecutivo}
                  </Link>
                </td>
                <td className={`${td} text-slate-600`}>
                  {new Date(v.fecha).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className={td}>{v.cliente}</td>
                <td className={td}>
                  {v.tipo === "contado" ? (FORMA[v.forma_pago] ?? v.forma_pago) : v.tipo === "credito" ? "Crédito" : "Separado"}
                  {v.saldo > 0 && <span className="ml-2 text-xs font-semibold text-red-600">debe {pesos(v.saldo)}</span>}
                </td>
                <td className={`${td} text-right font-medium tabular-nums`}>{pesos(v.total)}</td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      </Modal>

      {/* Productos activos */}
      <Modal
        abierto={abierto === "productos"}
        titulo="Productos activos"
        subtitulo={`${productos.length} producto(s)`}
        alCerrar={cerrar}
        pie={
          <Link href="/productos" className={enlacePie}>
            Ir a Productos
          </Link>
        }
      >
        <div className="sticky top-0 z-10 bg-white px-6 pt-4 pb-2">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o código..."
            autoFocus
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <Tabla vacia={filtrados.length === 0} mensaje="No hay productos con ese criterio.">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className={th}>Producto</th>
              <th className={`${th} text-right`}>Stock</th>
              <th className={`${th} text-right`}>Precio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtrados.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className={td}>
                  <Link href={`/productos/${p.id}`} className="text-slate-900 hover:text-blue-700">
                    {p.nombre}
                  </Link>
                  <p className="font-mono text-xs text-slate-500">{p.codigo}</p>
                </td>
                <td className={`${td} text-right tabular-nums ${p.stock <= 0 ? "font-semibold text-red-600" : ""}`}>
                  {cantidad(p.stock)}
                </td>
                <td className={`${td} text-right tabular-nums`}>{pesos(p.precio_venta)}</td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      </Modal>

      {/* Unidades en inventario */}
      <Modal
        abierto={abierto === "inventario"}
        titulo="Unidades en inventario"
        subtitulo={`${cantidad(unidades)} unidades${verCostos ? ` · valor al costo ${pesos(valorCosto)}` : ""}`}
        alCerrar={cerrar}
        pie={
          <Link href="/productos" className={enlacePie}>
            Ir a Productos
          </Link>
        }
      >
        <Tabla vacia={porValor.length === 0} mensaje="No hay unidades en inventario.">
          <thead className="sticky top-0 bg-slate-50 text-slate-600">
            <tr>
              <th className={th}>Producto</th>
              <th className={`${th} text-right`}>Unidades</th>
              {verCostos && <th className={`${th} text-right`}>Costo prom.</th>}
              {verCostos && <th className={`${th} text-right`}>Valor al costo</th>}
              {verCostos && <th className={`${th} text-right`}>% del total</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {porValor.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className={td}>
                  <Link href={`/productos/${p.id}`} className="text-slate-900 hover:text-blue-700">
                    {p.nombre}
                  </Link>
                  <p className="font-mono text-xs text-slate-500">{p.codigo}</p>
                </td>
                <td className={`${td} text-right tabular-nums`}>{cantidad(p.stock)}</td>
                {verCostos && <td className={`${td} text-right tabular-nums text-slate-600`}>{pesos(p.costo_promedio)}</td>}
                {verCostos && <td className={`${td} text-right font-medium tabular-nums`}>{pesos(p.valor)}</td>}
                {verCostos && (
                  <td className={`${td} text-right tabular-nums text-slate-500`}>
                    {valorCosto ? `${((p.valor / valorCosto) * 100).toFixed(1)}%` : "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Tabla>
      </Modal>

      {/* Alertas de stock */}
      <Modal
        abierto={abierto === "alertas"}
        titulo="Alertas de stock"
        subtitulo="Productos sin existencias o en el stock mínimo o por debajo"
        alCerrar={cerrar}
        pie={
          <Link href="/productos?filtro=bajo-minimo" className={enlacePie}>
            Ver en Productos
          </Link>
        }
      >
        <Tabla vacia={alertas.length === 0} mensaje="Todo el inventario está por encima del mínimo.">
          <thead className="sticky top-0 bg-slate-50 text-slate-600">
            <tr>
              <th className={th}>Producto</th>
              <th className={`${th} text-right`}>Stock</th>
              <th className={`${th} text-right`}>Mínimo</th>
              <th className={th}>Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {alertas.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className={td}>
                  <Link href={`/productos/${p.id}`} className="text-slate-900 hover:text-blue-700">
                    {p.nombre}
                  </Link>
                  <p className="font-mono text-xs text-slate-500">{p.codigo}</p>
                </td>
                <td className={`${td} text-right font-semibold tabular-nums text-red-600`}>{cantidad(p.stock)}</td>
                <td className={`${td} text-right tabular-nums text-slate-600`}>{p.stock_minimo > 0 ? cantidad(p.stock_minimo) : "—"}</td>
                <td className={td}>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.stock <= 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {p.stock <= 0 ? "Agotado" : "Bajo mínimo"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      </Modal>
    </>
  );
}

function Tabla({ vacia, mensaje, children }: { vacia: boolean; mensaje: string; children: React.ReactNode }) {
  if (vacia) return <p className="px-6 py-10 text-center text-sm text-slate-500">{mensaje}</p>;
  return (
    <div className="px-2 pb-2">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}
