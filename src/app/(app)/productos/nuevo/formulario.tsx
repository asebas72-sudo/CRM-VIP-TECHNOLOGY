"use client";

import { useActionState, useState } from "react";
import { botonPrimario, Dialogo } from "@/components/dialogo";
import { margen, precioConMargen } from "@/lib/precios";
import { crearProducto, type Resultado } from "../acciones";

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20";
const etiqueta = "block text-sm font-medium text-slate-700";

const soloNumero = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0;

export function FormularioNuevoProducto({
  categorias,
  margenDefecto,
}: {
  categorias: { id: string; nombre: string }[];
  margenDefecto: number;
}) {
  const [estado, accion, guardando] = useActionState<Resultado, FormData>(crearProducto, {});
  const [cerrado, setCerrado] = useState<Resultado | null>(null);
  const [nuevaCategoria, setNuevaCategoria] = useState(categorias.length === 0);
  const [costo, setCosto] = useState("");
  const [precio, setPrecio] = useState("");
  const [iva, setIva] = useState("19");

  const costoNum = soloNumero(costo);
  const ivaNum = Number(iva) || 0;
  const m = margen(soloNumero(precio), costoNum, ivaNum);

  return (
    <form action={accion} className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={`${etiqueta} sm:col-span-2`}>
          Nombre *
          <input name="nombre" required autoFocus className={campo} placeholder="Ej: Mouse inalámbrico Logitech M170" />
        </label>
        <label className={etiqueta}>
          Código (va en el QR)
          <input
            name="codigo"
            className={`${campo} font-mono`}
            placeholder="Vacío = se asigna solo (P00001)"
            // El lector de código de barras termina con Enter: que no envíe el formulario
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          />
          <span className="text-xs font-normal text-slate-500">Puede escanear el código de barras del producto.</span>
        </label>
        <label className={etiqueta}>
          Marca
          <input name="marca" className={campo} />
        </label>
        <div className={etiqueta}>
          <div className="flex items-center justify-between">
            Categoría
            {categorias.length > 0 && (
              <button
                type="button"
                onClick={() => setNuevaCategoria(!nuevaCategoria)}
                className="text-xs font-normal text-blue-700 hover:underline"
              >
                {nuevaCategoria ? "Elegir existente" : "+ Nueva categoría"}
              </button>
            )}
          </div>
          {nuevaCategoria ? (
            <input name="categoria_nueva" placeholder="Ej: Mouse, Audífonos, Redes..." className={campo} />
          ) : (
            <select name="categoria_id" defaultValue="" className={campo}>
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
          <input name="ubicacion" className={campo} />
        </label>
      </div>

      <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
        <label className={etiqueta}>
          Costo unitario (sin IVA)
          <input name="costo" value={costo} onChange={(e) => setCosto(e.target.value)} inputMode="numeric" className={campo} placeholder="0" />
        </label>
        <label className={etiqueta}>
          IVA %
          <select name="iva_porcentaje" value={iva} onChange={(e) => setIva(e.target.value)} className={campo}>
            {["0", "5", "19"].map((v) => (
              <option key={v} value={v}>
                {v}%
              </option>
            ))}
          </select>
        </label>
        <label className={etiqueta}>
          Precio de venta (IVA incluido)
          <input
            name="precio_venta"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            inputMode="numeric"
            className={`${campo} text-lg font-semibold`}
            placeholder="0"
          />
        </label>
        <div className="text-sm text-slate-600 sm:pt-6">
          <p className={m !== null && m < 0 ? "font-semibold text-red-600" : "font-semibold text-slate-900"}>
            Margen: {m === null ? "—" : `${m.toFixed(1)}%`}
          </p>
          {costoNum > 0 && (
            <button
              type="button"
              className="mt-1 text-xs text-blue-700 hover:underline"
              onClick={() => setPrecio(String(precioConMargen(costoNum, ivaNum, margenDefecto)))}
            >
              Usar margen de la empresa ({margenDefecto}%)
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className={etiqueta}>
          Cantidad inicial
          <input name="stock_inicial" inputMode="numeric" className={campo} placeholder="0" />
        </label>
        <label className={etiqueta}>
          Stock mínimo (alerta)
          <input name="stock_minimo" inputMode="numeric" className={campo} placeholder="0" />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 sm:pt-6">
          <input type="checkbox" name="maneja_serial" />
          Maneja serial (se pide al vender)
        </label>
      </div>

      <button disabled={guardando} className={botonPrimario}>
        {guardando ? "Creando..." : "Crear producto"}
      </button>

      <Dialogo
        abierto={Boolean(estado.error) && cerrado !== estado}
        tono="error"
        titulo="No se pudo crear"
        alCerrar={() => setCerrado(estado)}
        acciones={
          <button type="button" className={botonPrimario} onClick={() => setCerrado(estado)}>
            Entendido
          </button>
        }
      >
        <p>{estado.error}</p>
      </Dialogo>
    </form>
  );
}
