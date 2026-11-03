"use client";

import { useActionState } from "react";
import { crearEmpresa, type EstadoEmpresa } from "./acciones";

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20";

export function CrearEmpresa() {
  const [estado, accion, cargando] = useActionState<EstadoEmpresa, FormData>(crearEmpresa, {});

  return (
    <form action={accion} className="mx-auto mt-10 max-w-md space-y-4 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Cree su primera empresa</h2>
        <p className="text-sm text-slate-500">Quedará como administrador y podrá invitar a su equipo.</p>
      </div>
      <label className="block text-sm font-medium text-slate-700">
        Nombre de la empresa
        <input name="nombre" className={campo} required />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        NIT (opcional)
        <input name="nit" className={campo} />
      </label>
      {estado.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{estado.error}</p>}
      <button
        disabled={cargando}
        className="w-full rounded-lg bg-blue-600 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {cargando ? "Creando..." : "Crear empresa"}
      </button>
    </form>
  );
}
