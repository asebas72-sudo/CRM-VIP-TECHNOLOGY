"use client";

import { useActionState, useState, useTransition } from "react";
import { botonPrimario, botonSecundario, Dialogo } from "@/components/dialogo";
import { enlaceWhatsapp } from "@/lib/servicio";
import {
  cambiarCelular,
  cambiarRol,
  crearUsuario,
  eliminarUsuario,
  restablecerClave,
  type Credenciales,
  type EstadoAgregar,
} from "./acciones";

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20";

/** El superadmin crea la cuenta del usuario con una contraseña temporal. */
export function FormularioAgregar({ empresas }: { empresas: { id: string; nombre: string }[] }) {
  const [estado, accion, cargando] = useActionState<EstadoAgregar, FormData>(crearUsuario, {});
  const [cerrado, setCerrado] = useState<EstadoAgregar | null>(null);
  const [superadmin, setSuperadmin] = useState(false);

  return (
    <details className="group rounded-2xl bg-white ring-1 ring-slate-200">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4">
        <span className="font-semibold text-slate-900">➕ Crear usuario</span>
        <span className="text-xs text-slate-400 transition group-open:rotate-90">▶</span>
      </summary>
      <form action={accion} className="space-y-4 border-t border-slate-100 p-5">
        <p className="text-sm text-slate-500">
          El sistema genera una contraseña temporal que usted le entrega (por WhatsApp o en persona). La primera vez que
          entre, el sistema le pedirá cambiarla.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium text-slate-700">
            Nombre completo *
            <input name="nombre" required className={campo} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Correo (usuario para entrar) *
            <input name="correo" type="email" required className={campo} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Celular (WhatsApp)
            <input name="celular" inputMode="numeric" className={campo} />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="superadmin" checked={superadmin} onChange={(e) => setSuperadmin(e.target.checked)} />
          <strong>Superadmin</strong> (ve todas las empresas y gestiona usuarios)
        </label>

        {!superadmin && (
          <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
            <label className="block text-sm font-medium text-slate-700">
              Rol
              <select name="rol" className={campo} defaultValue="vendedor">
                <option value="admin">Administrador</option>
                <option value="bodega">Bodega</option>
                <option value="vendedor">Vendedor</option>
                <option value="tecnico">Técnico (reparaciones)</option>
              </select>
            </label>
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
          </div>
        )}

        <button disabled={cargando} className="rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {cargando ? "Creando..." : "Crear usuario"}
        </button>
      </form>

      <Dialogo
        abierto={Boolean(estado.error) && cerrado !== estado}
        tono="error"
        titulo="No se pudo crear el usuario"
        alCerrar={() => setCerrado(estado)}
        acciones={
          <button type="button" className={botonPrimario} onClick={() => setCerrado(estado)}>
            Entendido
          </button>
        }
      >
        <p>{estado.error}</p>
      </Dialogo>
      <AvisoCredenciales
        credenciales={estado.credenciales && cerrado !== estado ? estado.credenciales : null}
        titulo="Usuario creado"
        alCerrar={() => {
          setCerrado(estado);
          setSuperadmin(false);
        }}
      />
    </details>
  );
}

/** Muestra los datos de acceso para copiarlos o enviarlos por WhatsApp. */
function AvisoCredenciales({
  credenciales,
  titulo,
  alCerrar,
}: {
  credenciales: Credenciales | null;
  titulo: string;
  alCerrar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const sitio = typeof window === "undefined" ? "" : window.location.origin;
  const texto = credenciales
    ? [
        `Hola ${credenciales.nombre},`,
        "estos son tus datos para entrar al sistema CRM VIP TECHNOLOGY:",
        "",
        `- Página: ${sitio}`,
        `- Usuario: ${credenciales.correo}`,
        `- Contraseña temporal: ${credenciales.clave}`,
        "",
        "La primera vez que entres te pedirá crear tu propia contraseña.",
      ].join("\n")
    : "";
  const wa = credenciales?.celular ? enlaceWhatsapp(credenciales.celular, texto) : null;

  return (
    <Dialogo
      abierto={credenciales !== null}
      tono="exito"
      titulo={titulo}
      alCerrar={alCerrar}
      acciones={
        <>
          <button
            type="button"
            className={botonSecundario}
            onClick={async () => {
              await navigator.clipboard.writeText(texto).catch(() => undefined);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            }}
          >
            {copiado ? "¡Copiado!" : "Copiar datos"}
          </button>
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
              📲 Enviar por WhatsApp
            </a>
          )}
          <button type="button" className={botonPrimario} onClick={alCerrar}>
            Listo
          </button>
        </>
      }
    >
      <p>Entréguele estos datos al usuario. La contraseña no se vuelve a mostrar.</p>
      <pre className="rounded-lg bg-slate-100 p-3 text-sm whitespace-pre-wrap text-slate-900 select-all">{texto}</pre>
    </Dialogo>
  );
}

/** Nueva contraseña temporal para quien olvidó la suya. */
export function RestablecerClave({ usuarioId, nombre }: { usuarioId: string; nombre: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [credenciales, setCredenciales] = useState<Credenciales | null>(null);
  const [error, setError] = useState<string>();
  const [procesando, iniciar] = useTransition();

  return (
    <>
      <button type="button" onClick={() => setConfirmando(true)} className="text-xs font-medium text-blue-700 hover:underline">
        Nueva contraseña
      </button>
      <Dialogo
        abierto={confirmando}
        titulo={`¿Generar una contraseña temporal para ${nombre}?`}
        alCerrar={procesando ? undefined : () => setConfirmando(false)}
        acciones={
          <>
            <button type="button" className={botonSecundario} onClick={() => setConfirmando(false)} disabled={procesando}>
              Cancelar
            </button>
            <button
              type="button"
              className={botonPrimario}
              disabled={procesando}
              onClick={() =>
                iniciar(async () => {
                  const r = await restablecerClave(usuarioId);
                  setConfirmando(false);
                  if (r.error) setError(r.error);
                  else setCredenciales(r.credenciales ?? null);
                })
              }
            >
              {procesando ? "Generando..." : "Sí, generar"}
            </button>
          </>
        }
      >
        <p>Su contraseña actual dejará de funcionar y deberá cambiar la nueva al entrar.</p>
      </Dialogo>
      <AvisoCredenciales credenciales={credenciales} titulo="Contraseña restablecida" alCerrar={() => setCredenciales(null)} />
      <Dialogo
        abierto={Boolean(error)}
        tono="error"
        titulo="No se pudo restablecer"
        alCerrar={() => setError(undefined)}
        acciones={
          <button type="button" className={botonPrimario} onClick={() => setError(undefined)}>
            Entendido
          </button>
        }
      >
        <p>{error}</p>
      </Dialogo>
    </>
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
        <option value="tecnico">Técnico (reparaciones)</option>
      </select>
    </form>
  );
}

/** Celular del usuario (se usa para avisar a los técnicos por WhatsApp). */
export function CampoCelular({ usuarioId, celular }: { usuarioId: string; celular: string | null }) {
  const [valor, setValor] = useState(celular ?? "");
  const [guardado, setGuardado] = useState(celular ?? "");
  const [error, setError] = useState(false);
  const [guardando, iniciar] = useTransition();
  const cambiado = valor.replace(/\D/g, "") !== guardado;

  return (
    <div className="mt-1 flex items-center gap-1">
      <input
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        inputMode="numeric"
        placeholder="Celular"
        aria-label="Celular"
        className={`w-32 rounded-md border px-2 py-0.5 text-xs ${error ? "border-red-500" : "border-slate-300"}`}
      />
      {cambiado && (
        <button
          disabled={guardando}
          onClick={() =>
            iniciar(async () => {
              const r = await cambiarCelular(usuarioId, valor);
              setError(Boolean(r.error));
              if (!r.error) setGuardado(valor.replace(/\D/g, ""));
            })
          }
          className="rounded-md bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white"
        >
          {guardando ? "..." : "Guardar"}
        </button>
      )}
    </div>
  );
}

/** Eliminar un usuario sin historial (si tiene registros, se debe inactivar). */
export function EliminarUsuario({ usuarioId, nombre }: { usuarioId: string; nombre: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string>();
  const [eliminando, iniciar] = useTransition();

  return (
    <>
      <button type="button" onClick={() => setConfirmando(true)} className="text-xs font-medium text-red-600 hover:underline">
        Eliminar
      </button>
      <Dialogo
        abierto={confirmando}
        tono="advertencia"
        titulo={`¿Eliminar a ${nombre}?`}
        alCerrar={eliminando ? undefined : () => setConfirmando(false)}
        acciones={
          <>
            <button type="button" className={botonSecundario} onClick={() => setConfirmando(false)} disabled={eliminando}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={eliminando}
              onClick={() =>
                iniciar(async () => {
                  const r = await eliminarUsuario(usuarioId);
                  setConfirmando(false);
                  if (r.error) setError(r.error);
                })
              }
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {eliminando ? "Eliminando..." : "Sí, eliminar"}
            </button>
          </>
        }
      >
        <p>Se borra la cuenta y todos sus accesos. Esta acción no se puede deshacer.</p>
        <p>Si el usuario ya registró ventas, compras u órdenes, no se puede eliminar: inactívelo para conservar el historial.</p>
      </Dialogo>
      <Dialogo
        abierto={Boolean(error)}
        tono="error"
        titulo="No se pudo eliminar"
        alCerrar={() => setError(undefined)}
        acciones={
          <button type="button" className={botonPrimario} onClick={() => setError(undefined)}>
            Entendido
          </button>
        }
      >
        <p>{error}</p>
      </Dialogo>
    </>
  );
}
