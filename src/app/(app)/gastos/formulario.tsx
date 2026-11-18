"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { botonPrimario } from "@/components/dialogo";
import { borrarGasto, registrarGasto, type Resultado } from "./acciones";
import { CATEGORIAS, FORMAS_PAGO_GASTO, TIPOS_GASTO } from "./opciones";

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20";
const etiqueta = "block text-sm font-medium text-slate-700";

export function FormularioGasto({ hoy }: { hoy: string }) {
  const [estado, accion, guardando] = useActionState<Resultado, FormData>(registrarGasto, {});
  const [tipo, setTipo] = useState("gasto");
  const [valor, setValor] = useState("");
  const form = useRef<HTMLFormElement>(null);

  // Guardado: limpia descripción, valor y beneficiario; deja fecha, tipo y forma de pago para el siguiente
  useEffect(() => {
    if (!estado.ok || !form.current) return;
    for (const nombre of ["descripcion", "beneficiario"]) {
      const c = form.current.elements.namedItem(nombre);
      if (c instanceof HTMLInputElement) c.value = "";
    }
    setValor("");
  }, [estado]);

  const valorMostrado = valor ? Number(valor).toLocaleString("es-CO") : "";

  return (
    <form ref={form} action={accion} className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <h2 className="font-semibold text-slate-900">Registrar</h2>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
        {Object.entries(TIPOS_GASTO).map(([v, t]) => (
          <button
            key={v}
            type="button"
            onClick={() => setTipo(v)}
            className={`flex-1 rounded-md px-3 py-2 font-semibold ${tipo === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
          >
            {t}
            <span className="block text-xs font-normal text-slate-500">
              {v === "gasto" ? "Arriendo, servicios, nómina..." : "Equipos, herramientas, muebles..."}
            </span>
          </button>
        ))}
      </div>
      <input type="hidden" name="tipo" value={tipo} />

      <div className="grid gap-4 sm:grid-cols-3">
        <label className={etiqueta}>
          Fecha
          <input type="date" name="fecha" defaultValue={hoy} max={hoy} required className={campo} />
        </label>
        <label className={etiqueta}>
          Categoría
          <select key={tipo} name="categoria" className={campo}>
            {Object.entries(CATEGORIAS[tipo]).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className={etiqueta}>
          Valor
          <input
            name="valor"
            value={valorMostrado}
            onChange={(e) => setValor(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            required
            placeholder="0"
            className={`${campo} text-lg font-semibold`}
          />
        </label>
        <label className={`${etiqueta} sm:col-span-2`}>
          Descripción
          <input name="descripcion" required maxLength={500} placeholder={tipo === "gasto" ? "Ej: Arriendo del local de noviembre" : "Ej: Estación de soldadura para el taller"} className={campo} />
        </label>
        <label className={etiqueta}>
          Forma de pago
          <select name="forma_pago" defaultValue="efectivo" className={campo}>
            {Object.entries(FORMAS_PAGO_GASTO).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className={`${etiqueta} sm:col-span-3`}>
          ¿A quién se le pagó? <span className="font-normal text-slate-500">(opcional)</span>
          <input name="beneficiario" maxLength={150} placeholder="Ej: Inmobiliaria, EPM, nombre de la persona" className={campo} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={guardando} className={botonPrimario}>
          {guardando ? "Guardando..." : `Guardar ${tipo === "gasto" ? "gasto" : "inversión"}`}
        </button>
        {estado.ok && <span className="text-sm font-medium text-green-700">✓ Guardado</span>}
        {estado.error && <span className="text-sm text-red-700">{estado.error}</span>}
      </div>
    </form>
  );
}

export function BotonBorrarGasto({ id, descripcion }: { id: string; descripcion: string }) {
  const [borrando, iniciar] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <>
      <button
        type="button"
        disabled={borrando}
        className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
        onClick={() => {
          if (!confirm(`¿Borrar "${descripcion}"? No se puede deshacer.`)) return;
          iniciar(async () => {
            const r = await borrarGasto(id);
            if (r.error) setError(r.error);
          });
        }}
      >
        {borrando ? "Borrando..." : "Borrar"}
      </button>
      {error && <span className="block text-xs text-red-700">{error}</span>}
    </>
  );
}
