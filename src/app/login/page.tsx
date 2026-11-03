"use client";

import { useActionState } from "react";
import { iniciarSesion, type EstadoLogin } from "./acciones";

const campo =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20";

/** Solo inicio de sesión: los usuarios los crea el superadmin desde la app. */
export default function PaginaLogin() {
  const [estado, entrar, entrando] = useActionState<EstadoLogin, FormData>(iniciarSesion, {});

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-center text-2xl font-bold text-slate-900">CRM VIP TECHNOLOGY</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Inventario, ventas y servicio técnico</p>

        <form action={entrar} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Correo
            <input name="correo" type="email" className={`${campo} mt-1`} autoComplete="email" required />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Contraseña
            <input name="clave" type="password" className={`${campo} mt-1`} autoComplete="current-password" required />
          </label>

          {estado.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{estado.error}</p>}

          <button
            disabled={entrando}
            className="w-full rounded-lg bg-blue-600 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {entrando ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          ¿No tiene usuario u olvidó su contraseña? Pídasela al administrador del sistema.
        </p>
      </div>
    </main>
  );
}
