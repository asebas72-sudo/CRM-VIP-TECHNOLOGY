"use client";

import { useActionState, useState } from "react";
import { iniciarSesion, registrarse, type EstadoLogin } from "./acciones";

const campo =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20";

export default function PaginaLogin() {
  const [modo, setModo] = useState<"entrar" | "registro">("entrar");
  const [estadoEntrar, entrar, entrando] = useActionState<EstadoLogin, FormData>(iniciarSesion, {});
  const [estadoRegistro, registrar, registrando] = useActionState<EstadoLogin, FormData>(
    registrarse,
    {},
  );
  const estado = modo === "entrar" ? estadoEntrar : estadoRegistro;
  const cargando = entrando || registrando;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-center text-2xl font-bold text-slate-900">CRM VIP TECHNOLOGY</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Inventario, compras y ventas</p>

        <form action={modo === "entrar" ? entrar : registrar} className="mt-6 space-y-4">
          {modo === "registro" && (
            <label className="block text-sm font-medium text-slate-700">
              Nombre
              <input name="nombre" className={`${campo} mt-1`} autoComplete="name" required />
            </label>
          )}
          <label className="block text-sm font-medium text-slate-700">
            Correo
            <input name="correo" type="email" className={`${campo} mt-1`} autoComplete="email" required />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Contraseña
            <input
              name="clave"
              type="password"
              className={`${campo} mt-1`}
              autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              required
            />
          </label>

          {estado.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{estado.error}</p>}
          {estado.mensaje && (
            <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{estado.mensaje}</p>
          )}

          <button
            disabled={cargando}
            className="w-full rounded-lg bg-blue-600 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {cargando ? "Procesando..." : modo === "entrar" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setModo(modo === "entrar" ? "registro" : "entrar")}
          className="mt-4 w-full text-center text-sm text-blue-700 hover:underline"
        >
          {modo === "entrar" ? "¿No tiene cuenta? Regístrese" : "¿Ya tiene cuenta? Inicie sesión"}
        </button>
      </div>
    </main>
  );
}
