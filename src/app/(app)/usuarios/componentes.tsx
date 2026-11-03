"use client";

import { useActionState } from "react";
import { agregarUsuario, cambiarRol, type EstadoAgregar } from "./acciones";

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20";

export function FormularioAgregar({ empresas }: { empresas: { id: string; nombre: string }[] }) {
  const [estado, accion, cargando] = useActionState<EstadoAgregar, FormData>(agregarUsuario, {});

  return (
    <form action={accion} className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div>
        <h2 className="font-semibold text-slate-900">Dar acceso a un usuario</h2>
        <p className="text-sm text-slate-500">
          La persona debe registrarse primero en la pantalla de inicio de sesión con su correo.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Correo
          <input name="correo" type="email" className={campo} required />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Rol
          <select name="rol" className={campo} defaultValue="vendedor">
            <option value="admin">Administrador</option>
            <option value="bodega">Bodega</option>
            <option value="vendedor">Vendedor</option>
          </select>
        </label>
      </div>
      <fieldset>
        <legend className="text-sm font-medium text-slate-700">Empresas</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {empresas.map((e) => (
            <label
              key={e.id}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50"
            >
              <input type="checkbox" name="empresas" value={e.id} defaultChecked={empresas.length === 1} />
              {e.nombre}
            </label>
          ))}
        </div>
      </fieldset>
      {estado.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{estado.error}</p>}
      {estado.mensaje && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{estado.mensaje}</p>}
      <button
        disabled={cargando}
        className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {cargando ? "Guardando..." : "Dar acceso"}
      </button>
    </form>
  );
}

/** Selector de rol de un usuario en una empresa; guarda al cambiar. */
export function SelectorRol({
  usuarioId,
  correo,
  empresaId,
  rol,
  deshabilitado,
}: {
  usuarioId: string;
  correo: string;
  empresaId: string;
  rol: string;
  deshabilitado?: boolean;
}) {
  return (
    <form action={cambiarRol}>
      <input type="hidden" name="usuario_id" value={usuarioId} />
      <input type="hidden" name="correo" value={correo} />
      <input type="hidden" name="empresa_id" value={empresaId} />
      <select
        name="rol"
        defaultValue={rol}
        disabled={deshabilitado}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm disabled:bg-slate-100 disabled:text-slate-400"
      >
        <option value="">Sin acceso</option>
        <option value="admin">Administrador</option>
        <option value="bodega">Bodega</option>
        <option value="vendedor">Vendedor</option>
      </select>
    </form>
  );
}
