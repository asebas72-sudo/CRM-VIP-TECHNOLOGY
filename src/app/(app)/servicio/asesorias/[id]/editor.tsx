"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { botonExito, botonPrimario, botonSecundario, Dialogo } from "@/components/dialogo";
import type { Rol } from "@/lib/empresa";
import {
  enlaceWhatsapp,
  ESTADOS_ASESORIA,
  ESTILO_ESTADO_ASESORIA,
  mensajeAsesoriaCliente,
  mensajeAsesoriaTecnico,
  type EstadoAsesoria,
} from "@/lib/servicio";
import { actualizarAsesoria } from "../../acciones";
import { campo, etiqueta } from "../../cliente-campos";

type Tecnico = { usuario_id: string; nombre: string; celular: string | null };

export type AsesoriaEditable = {
  id: string;
  consecutivo: number;
  cliente: string;
  celular: string;
  solicitud: string;
  fallas: string | null;
  estado: EstadoAsesoria;
  tecnico_id: string | null;
  fecha_visita: string; // aaaa-mm-ddThh:mm
  costo: number | null;
  observacion_final: string | null;
};

const visitaLegible = (v: string) =>
  v ? new Date(`${v}:00-05:00`).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "full", timeStyle: "short" }) : null;

export function EditorAsesoria({
  asesoria,
  tecnicos,
  rol,
  usuarioId,
  empresa,
}: {
  asesoria: AsesoriaEditable;
  tecnicos: Tecnico[];
  rol: Rol;
  usuarioId: string;
  empresa: string;
}) {
  const router = useRouter();
  const bloqueada = asesoria.estado === "REALIZADA";
  const [f, setF] = useState({
    estado: asesoria.estado,
    tecnico_id: asesoria.tecnico_id ?? "",
    fecha_visita: asesoria.fecha_visita,
    costo: asesoria.costo != null ? String(Math.round(asesoria.costo)) : "",
    observacion_final: asesoria.observacion_final ?? "",
  });
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string>();
  const [confirmarRealizada, setConfirmarRealizada] = useState(false);
  const [guardando, iniciar] = useTransition();

  const editar = (c: Partial<typeof f>) => setF((a) => ({ ...a, ...c }));
  const opciones = rol === "tecnico" ? tecnicos.filter((t) => t.usuario_id === usuarioId) : tecnicos;
  const tecnico = tecnicos.find((t) => t.usuario_id === f.tecnico_id);
  const visita = visitaLegible(f.fecha_visita);

  const waTecnico =
    tecnico?.celular &&
    enlaceWhatsapp(
      tecnico.celular,
      mensajeAsesoriaTecnico({
        tecnico: tecnico.nombre,
        numero: asesoria.consecutivo,
        cliente: asesoria.cliente,
        celular: asesoria.celular,
        solicitud: asesoria.solicitud,
        fallas: asesoria.fallas,
        fechaVisita: visita,
      }),
    );
  const waCliente = enlaceWhatsapp(
    asesoria.celular,
    mensajeAsesoriaCliente({ empresa, nombre: asesoria.cliente, numero: asesoria.consecutivo, solicitud: asesoria.solicitud, fechaVisita: visita }),
  );

  function guardar(estado = f.estado) {
    setError(undefined);
    const datos = new FormData();
    datos.set("id", asesoria.id);
    for (const [k, v] of Object.entries({ ...f, estado })) datos.set(k, v);
    iniciar(async () => {
      const r = await actualizarAsesoria(datos);
      setConfirmarRealizada(false);
      if (!r.ok) setError(r.error);
      else {
        setGuardado(true);
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-5 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-900">Gestión de la asesoría</h2>
        {!bloqueada && (
          <button type="button" onClick={() => setConfirmarRealizada(true)} className={botonExito}>
            ✅ Marcar como realizada
          </button>
        )}
      </div>

      {bloqueada && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800 ring-1 ring-green-200">
          Esta asesoría ya fue realizada y no admite más cambios.
        </p>
      )}

      <fieldset disabled={bloqueada} className="grid gap-4 sm:grid-cols-2">
        <label className={etiqueta}>
          Estado
          <select value={f.estado} onChange={(e) => editar({ estado: e.target.value as EstadoAsesoria })} className={campo}>
            {ESTADOS_ASESORIA.map((e) => (
              <option key={e} value={e}>
                {ESTILO_ESTADO_ASESORIA[e].icono} {ESTILO_ESTADO_ASESORIA[e].texto}
              </option>
            ))}
          </select>
        </label>
        <label className={etiqueta}>
          Técnico asignado
          <select value={f.tecnico_id} onChange={(e) => editar({ tecnico_id: e.target.value })} className={campo}>
            <option value="">Sin asignar</option>
            {opciones.map((t) => (
              <option key={t.usuario_id} value={t.usuario_id}>
                {t.nombre}
              </option>
            ))}
            {f.tecnico_id && !opciones.some((t) => t.usuario_id === f.tecnico_id) && (
              <option value={f.tecnico_id}>{tecnico?.nombre ?? "Otro técnico"}</option>
            )}
          </select>
        </label>
        <label className={etiqueta}>
          Fecha y hora de la visita
          <input
            type="datetime-local"
            value={f.fecha_visita}
            onChange={(e) => editar({ fecha_visita: e.target.value })}
            className={campo}
          />
        </label>
        <label className={etiqueta}>
          Costo
          <input
            value={f.costo ? Number(f.costo).toLocaleString("es-CO") : ""}
            onChange={(e) => editar({ costo: e.target.value.replace(/\D/g, "") })}
            inputMode="numeric"
            placeholder="$ 0"
            className={`${campo} text-right tabular-nums`}
          />
        </label>
        <label className={`${etiqueta} sm:col-span-2`}>
          Observación final
          <textarea
            value={f.observacion_final}
            onChange={(e) => editar({ observacion_final: e.target.value })}
            rows={4}
            placeholder="Trabajo realizado, materiales, recomendaciones..."
            className={campo}
          />
        </label>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {waTecnico && (
            <a href={waTecnico} target="_blank" rel="noreferrer" className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">
              📲 Avisar al técnico
            </a>
          )}
          {waCliente && (
            <a href={waCliente} target="_blank" rel="noreferrer" className="rounded-lg border border-green-600 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-50">
              📲 Confirmar al cliente
            </a>
          )}
        </div>
        {!bloqueada && (
          <button type="button" onClick={() => guardar()} disabled={guardando} className={`${botonPrimario} bg-violet-700 px-6 hover:bg-violet-800`}>
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        )}
      </div>

      <Dialogo
        abierto={guardado}
        tono="exito"
        titulo="Asesoría actualizada"
        alCerrar={() => setGuardado(false)}
        acciones={
          <button type="button" className={botonPrimario} onClick={() => setGuardado(false)}>
            Entendido
          </button>
        }
      >
        <p>Recuerde avisar al técnico y confirmar la visita al cliente con los botones de WhatsApp.</p>
      </Dialogo>

      <Dialogo
        abierto={confirmarRealizada}
        titulo="¿Marcar la asesoría como realizada?"
        alCerrar={() => setConfirmarRealizada(false)}
        acciones={
          <>
            <button type="button" className={botonSecundario} onClick={() => setConfirmarRealizada(false)}>
              Cancelar
            </button>
            <button type="button" className={botonExito} onClick={() => guardar("REALIZADA")} disabled={guardando}>
              {guardando ? "Guardando..." : "Sí, realizada"}
            </button>
          </>
        }
      >
        <p>Se guardarán el costo y la observación final. Después ya no se podrá editar.</p>
      </Dialogo>

      <Dialogo
        abierto={Boolean(error)}
        tono="error"
        titulo="No se pudo guardar"
        alCerrar={() => setError(undefined)}
        acciones={
          <button type="button" className={botonPrimario} onClick={() => setError(undefined)}>
            Entendido
          </button>
        }
      >
        <p>{error}</p>
      </Dialogo>
    </section>
  );
}
