"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { botonPrimario } from "@/components/dialogo";
import { cambiarActivoTecnico, crearTecnico, type Resultado } from "./acciones";

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20";

export function FormularioTecnico({ empresas }: { empresas: { id: string; nombre: string }[] }) {
  const [estado, accion, guardando] = useActionState<Resultado, FormData>(crearTecnico, {});
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) form.current?.reset();
  }, [estado]);

  return (
    <form
      ref={form}
      action={accion}
      className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
    >
      <label className="block text-sm font-medium text-slate-700">
        Nombre
        <input name="nombre" required autoComplete="off" placeholder="Ej. Andres Alvarez" className={campo} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Celular (opcional)
        <input name="celular" inputMode="tel" autoComplete="off" className={campo} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Empresa
        <select name="empresa_id" defaultValue="" className={campo}>
          <option value="">Todas las empresas</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
      </label>
      <button disabled={guardando} className={botonPrimario}>
        {guardando ? "Agregando..." : "Agregar técnico"}
      </button>
      {estado.error && <p className="text-sm text-red-700 sm:col-span-4">{estado.error}</p>}
      {estado.ok && <p className="text-sm text-green-700 sm:col-span-4">Técnico agregado.</p>}
    </form>
  );
}

export function BotonActivoTecnico({ id, activo }: { id: string; activo: boolean }) {
  const [cambiando, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={cambiando}
      onClick={() =>
        iniciar(async () => {
          const r = await cambiarActivoTecnico(id, !activo);
          if (r.error) alert(r.error);
        })
      }
      className={`text-sm font-medium hover:underline disabled:opacity-60 ${activo ? "text-red-600" : "text-blue-700"}`}
    >
      {cambiando ? "..." : activo ? "Inactivar" : "Activar"}
    </button>
  );
}
