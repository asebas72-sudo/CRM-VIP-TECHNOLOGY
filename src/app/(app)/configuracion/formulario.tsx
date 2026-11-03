"use client";

import { useActionState, useState } from "react";
import { botonPrimario, Dialogo } from "@/components/dialogo";
import { guardarConfiguracion, type Resultado } from "./acciones";

export type ConfiguracionEmpresa = {
  nombre: string;
  nit: string | null;
  direccion: string | null;
  telefono: string | null;
  ciudad: string | null;
  encabezado_tirilla: string | null;
  pie_tirilla: string | null;
  ancho_tirilla_mm: number;
  margen_defecto: number;
};

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20";
const etiqueta = "block text-sm font-medium text-slate-700";

export function FormularioConfiguracion({ empresa }: { empresa: ConfiguracionEmpresa }) {
  const [estado, accion, guardando] = useActionState<Resultado, FormData>(guardarConfiguracion, {});
  const [cerrado, setCerrado] = useState<Resultado | null>(null);

  return (
    <form action={accion} className="max-w-3xl space-y-6">
      <section className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="font-semibold text-slate-900">Datos de la empresa</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={etiqueta}>
            Nombre
            <input name="nombre" defaultValue={empresa.nombre} required className={campo} />
          </label>
          <label className={etiqueta}>
            NIT
            <input name="nit" defaultValue={empresa.nit ?? ""} className={campo} />
          </label>
          <label className={etiqueta}>
            Dirección
            <input name="direccion" defaultValue={empresa.direccion ?? ""} className={campo} />
          </label>
          <label className={etiqueta}>
            Ciudad
            <input name="ciudad" defaultValue={empresa.ciudad ?? ""} className={campo} />
          </label>
          <label className={etiqueta}>
            Teléfono
            <input name="telefono" defaultValue={empresa.telefono ?? ""} className={campo} />
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="font-semibold text-slate-900">Tirilla de venta</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={etiqueta}>
            Ancho del papel
            <select name="ancho_tirilla_mm" defaultValue={String(empresa.ancho_tirilla_mm)} className={campo}>
              <option value="80">80 mm</option>
              <option value="58">58 mm</option>
            </select>
          </label>
        </div>
        <label className={etiqueta}>
          Texto adicional del encabezado
          <textarea
            name="encabezado_tirilla"
            defaultValue={empresa.encabezado_tirilla ?? ""}
            rows={2}
            placeholder="Ej: Régimen simple · Instagram @viptechnology"
            className={campo}
          />
        </label>
        <label className={etiqueta}>
          Pie de la tirilla
          <textarea
            name="pie_tirilla"
            defaultValue={empresa.pie_tirilla ?? ""}
            rows={3}
            placeholder="Ej: Garantía de 30 días con esta tirilla. ¡Gracias por su compra!"
            className={campo}
          />
        </label>
      </section>

      <section className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="font-semibold text-slate-900">Precios</h2>
        <label className={`${etiqueta} max-w-xs`}>
          Margen por defecto (%)
          <input name="margen_defecto" defaultValue={empresa.margen_defecto} inputMode="decimal" className={campo} />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Se usa para el precio sugerido de los productos nuevos al importar compras.
          </span>
        </label>
      </section>

      <button disabled={guardando} className={`${botonPrimario} px-6 py-2.5`}>
        {guardando ? "Guardando..." : "Guardar configuración"}
      </button>

      <Dialogo
        abierto={(estado.ok || Boolean(estado.error)) && cerrado !== estado}
        tono={estado.ok ? "exito" : "error"}
        titulo={estado.ok ? "Configuración guardada" : "No se pudo guardar"}
        alCerrar={() => setCerrado(estado)}
        acciones={
          <button type="button" className={botonPrimario} onClick={() => setCerrado(estado)}>
            Entendido
          </button>
        }
      >
        {estado.error && <p>{estado.error}</p>}
      </Dialogo>
    </form>
  );
}
