"use client";

import { useActionState, useState } from "react";
import { cambiarClave, type EstadoClave } from "./acciones";

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20";

export function FormularioClave() {
  const [estado, accion, guardando] = useActionState<EstadoClave, FormData>(cambiarClave, {});
  const [ver, setVer] = useState(false);

  return (
    <form action={accion} className="mt-6 space-y-4">
      <label className="block text-sm font-medium text-slate-700">
        Nueva contraseña
        <input name="clave" type={ver ? "text" : "password"} autoComplete="new-password" required minLength={8} className={campo} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Repita la contraseña
        <input name="confirmacion" type={ver ? "text" : "password"} autoComplete="new-password" required className={campo} />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} />
        Mostrar contraseñas
      </label>
      <p className="text-xs text-slate-500">Mínimo 8 caracteres, con letras y números.</p>
      {estado.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{estado.error}</p>}
      <button
        disabled={guardando}
        className="w-full rounded-lg bg-blue-600 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {guardando ? "Guardando..." : "Guardar contraseña"}
      </button>
    </form>
  );
}
