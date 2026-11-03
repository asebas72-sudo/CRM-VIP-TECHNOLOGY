"use client";

import { useActionState, useState } from "react";
import { botonPrimario, botonSecundario, Dialogo } from "@/components/dialogo";
import { pesos } from "@/lib/formato";
import { margen, precioConMargen } from "@/lib/precios";
import { ajustarInventario, guardarProducto, type Resultado } from "../acciones";

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20";
const etiqueta = "block text-sm font-medium text-slate-700";

export type ProductoEditable = {
  id: string;
  codigo: string;
  nombre: string;
  marca: string | null;
  categoria_id: string | null;
  precio_venta: number;
  iva_porcentaje: number;
  costo_promedio: number;
  stock_minimo: number;
  ubicacion: string | null;
  maneja_serial: boolean;
  activo: boolean;
};

/** Muestra un popup con el resultado de un formulario (éxito o error). */
function AvisoResultado({ estado, exito }: { estado: Resultado; exito: string }) {
  const [cerrado, setCerrado] = useState<Resultado | null>(null);
  const abierto = (estado.ok || Boolean(estado.error)) && cerrado !== estado;
  return (
    <Dialogo
      abierto={abierto}
      tono={estado.ok ? "exito" : "error"}
      titulo={estado.ok ? exito : "No se pudo guardar"}
      alCerrar={() => setCerrado(estado)}
      acciones={
        <button className={botonPrimario} onClick={() => setCerrado(estado)}>
          Entendido
        </button>
      }
    >
      {estado.error && <p>{estado.error}</p>}
    </Dialogo>
  );
}

export function FormularioProducto({
  producto,
  categorias,
  margenDefecto,
}: {
  producto: ProductoEditable;
  categorias: { id: string; nombre: string }[];
  margenDefecto: number;
}) {
  const [estado, accion, guardando] = useActionState<Resultado, FormData>(guardarProducto, {});
  const [precio, setPrecio] = useState(String(Math.round(producto.precio_venta)));
  const [iva, setIva] = useState(String(producto.iva_porcentaje));
  const [nuevaCategoria, setNuevaCategoria] = useState(false);

  const precioNum = Number(precio.replace(/\D/g, "")) || 0;
  const ivaNum = Number(iva) || 0;
  const m = margen(precioNum, producto.costo_promedio, ivaNum);

  return (
    <form action={accion} className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <input type="hidden" name="id" value={producto.id} />
      <h2 className="font-semibold text-slate-900">Datos del producto</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={etiqueta}>
          Código (va en el QR)
          <input name="codigo" defaultValue={producto.codigo} required className={`${campo} font-mono`} />
        </label>
        <label className={etiqueta}>
          Marca
          <input name="marca" defaultValue={producto.marca ?? ""} className={campo} />
        </label>
        <label className={`${etiqueta} sm:col-span-2`}>
          Nombre
          <input name="nombre" defaultValue={producto.nombre} required className={campo} />
        </label>
        <div className={etiqueta}>
          <div className="flex items-center justify-between">
            Categoría
            <button
              type="button"
              onClick={() => setNuevaCategoria(!nuevaCategoria)}
              className="text-xs font-normal text-blue-700 hover:underline"
            >
              {nuevaCategoria ? "Elegir existente" : "+ Nueva categoría"}
            </button>
          </div>
          {nuevaCategoria ? (
            <input name="categoria_nueva" placeholder="Ej: Mouse, Audífonos, Redes..." className={campo} autoFocus />
          ) : (
            <select name="categoria_id" defaultValue={producto.categoria_id ?? ""} className={campo}>
              <option value="">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          )}
        </div>
        <label className={etiqueta}>
          Ubicación (estante, vitrina...)
          <input name="ubicacion" defaultValue={producto.ubicacion ?? ""} className={campo} />
        </label>
      </div>

      <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
        <label className={etiqueta}>
          Precio de venta (IVA incluido)
          <input
            name="precio_venta"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            inputMode="numeric"
            className={`${campo} text-lg font-semibold`}
          />
        </label>
        <label className={etiqueta}>
          IVA %
          <select name="iva_porcentaje" value={iva} onChange={(e) => setIva(e.target.value)} className={campo}>
            {["0", "5", "19"].map((v) => (
              <option key={v} value={v}>
                {v}%
              </option>
            ))}
            {!["0", "5", "19"].includes(iva) && <option value={iva}>{iva}%</option>}
          </select>
        </label>
        <div className="text-sm text-slate-600">
          <p>Costo promedio: {pesos(producto.costo_promedio)} + IVA</p>
          <p className={m !== null && m < 0 ? "font-semibold text-red-600" : "font-semibold text-slate-900"}>
            Margen: {m === null ? "—" : `${m.toFixed(1)}%`}
          </p>
          {producto.costo_promedio > 0 && (
            <button
              type="button"
              className="mt-1 text-xs text-blue-700 hover:underline"
              onClick={() => setPrecio(String(precioConMargen(producto.costo_promedio, ivaNum, margenDefecto)))}
            >
              Usar margen de la empresa ({margenDefecto}%)
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className={etiqueta}>
          Stock mínimo (alerta)
          <input name="stock_minimo" defaultValue={producto.stock_minimo} inputMode="numeric" className={campo} />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 sm:pt-6">
          <input type="checkbox" name="maneja_serial" defaultChecked={producto.maneja_serial} />
          Maneja serial (se pide al vender)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 sm:pt-6">
          <input type="checkbox" name="activo" defaultChecked={producto.activo} />
          Activo (disponible para vender)
        </label>
      </div>

      <button disabled={guardando} className={botonPrimario}>
        {guardando ? "Guardando..." : "Guardar cambios"}
      </button>
      <AvisoResultado estado={estado} exito="Producto actualizado" />
    </form>
  );
}

export function FormularioAjuste({ productoId }: { productoId: string }) {
  const [estado, accion, guardando] = useActionState<Resultado, FormData>(ajustarInventario, {});

  return (
    <form action={accion} className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <input type="hidden" name="producto_id" value={productoId} />
      <div>
        <h2 className="font-semibold text-slate-900">Ajuste de inventario</h2>
        <p className="text-xs text-slate-500">Para conteos físicos, daños o pérdidas. Queda registrado en el kardex.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={etiqueta}>
          Tipo
          <select name="tipo" className={campo}>
            <option value="ajuste_entrada">Entrada (+)</option>
            <option value="ajuste_salida">Salida (−)</option>
          </select>
        </label>
        <label className={etiqueta}>
          Cantidad
          <input name="cantidad" inputMode="numeric" required className={campo} />
        </label>
      </div>
      <label className={etiqueta}>
        Motivo
        <input name="nota" required placeholder="Ej: conteo físico, producto dañado..." className={campo} />
      </label>
      <button disabled={guardando} className={botonSecundario}>
        {guardando ? "Aplicando..." : "Aplicar ajuste"}
      </button>
      <AvisoResultado estado={estado} exito="Ajuste aplicado" />
    </form>
  );
}
