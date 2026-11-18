"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { botonPrimario, botonSecundario } from "@/components/dialogo";
import { crearMejora, gestionarMejora, type Resultado } from "./acciones";
import { AREAS, ESTADOS, PRIORIDADES, TIPOS } from "./opciones";

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20";
const etiqueta = "block text-sm font-medium text-slate-700";

export function FormularioMejora() {
  const [estado, accion, enviando] = useActionState<Resultado, FormData>(crearMejora, {});
  const form = useRef<HTMLFormElement>(null);

  // Al enviar bien, el formulario queda limpio para otra solicitud
  useEffect(() => {
    if (estado.ok) form.current?.reset();
  }, [estado]);

  return (
    <form ref={form} action={accion} className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <h2 className="font-semibold text-slate-900">Nueva solicitud</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className={etiqueta}>
          ¿Qué quiere reportar?
          <select name="tipo" defaultValue="mejora" className={campo}>
            {Object.entries(TIPOS).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className={etiqueta}>
          Parte del sistema
          <select name="area" defaultValue="ventas" className={campo}>
            {Object.entries(AREAS).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className={etiqueta}>
          ¿Qué tan importante es?
          <select name="prioridad" defaultValue="media" className={campo}>
            {Object.entries(PRIORIDADES).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={etiqueta}>
        Título
        <input name="titulo" required maxLength={150} placeholder="Ej: Poder imprimir la tirilla dos veces" className={campo} />
      </label>
      <label className={etiqueta}>
        Descripción
        <textarea
          name="descripcion"
          required
          rows={4}
          maxLength={4000}
          placeholder="Cuéntenos qué necesita, para qué le sirve y, si es una falla, qué estaba haciendo cuando pasó."
          className={campo}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={enviando} className={botonPrimario}>
          {enviando ? "Enviando..." : "Enviar solicitud"}
        </button>
        {estado.ok && <span className="text-sm font-medium text-green-700">✓ Recibida. Le avisaremos aquí cómo va.</span>}
        {estado.error && <span className="text-sm text-red-700">{estado.error}</span>}
      </div>
    </form>
  );
}

/** Cambiar estado y responder (solo acceso total). */
export function GestionMejora({ id, estado, respuesta }: { id: string; estado: string; respuesta: string | null }) {
  const [abierto, setAbierto] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState(estado);
  const [texto, setTexto] = useState(respuesta ?? "");
  const [error, setError] = useState<string>();
  const [guardando, iniciar] = useTransition();

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="text-sm font-medium text-blue-700 hover:underline">
        Gestionar
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <label className={etiqueta}>
        Estado
        <select value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)} className={campo}>
          {Object.entries(ESTADOS).map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className={etiqueta}>
        Respuesta para el usuario
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} className={campo} placeholder="Opcional" />
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={guardando}
          className={botonPrimario}
          onClick={() =>
            iniciar(async () => {
              const r = await gestionarMejora(id, nuevoEstado, texto);
              if (r.error) setError(r.error);
              else setAbierto(false);
            })
          }
        >
          {guardando ? "Guardando..." : "Guardar"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className={botonSecundario}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
