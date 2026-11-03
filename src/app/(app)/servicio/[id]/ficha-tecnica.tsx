"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { botonExito, botonPrimario, botonSecundario, Dialogo } from "@/components/dialogo";
import { pesos } from "@/lib/formato";
import { comprimirImagen } from "@/lib/imagenes";
import type { Rol } from "@/lib/empresa";
import {
  enlaceWhatsapp,
  ESTADOS_ORDEN,
  ESTILO_ESTADO_ORDEN,
  MAX_FOTOS,
  mensajeActualizacion,
  type CambioOrden,
  type EstadoOrden,
} from "@/lib/servicio";
import { actualizarOrden, entregarOrden } from "../acciones";
import { campo, etiqueta } from "../cliente-campos";

export type OrdenEditable = {
  id: string;
  codigo: string;
  cliente: string;
  celular: string;
  correo: string | null;
  equipo: string;
  estado: EstadoOrden;
  tecnico_id: string | null;
  costo: number | null;
  fecha_reparacion: string | null;
  comentario1: string | null;
  comentario2: string | null;
  observacion_final: string | null;
  fotos: { ruta: string; url: string }[];
};

type Tecnico = { usuario_id: string; nombre: string; celular: string | null };

export function FichaTecnica({
  orden,
  tecnicos,
  rol,
  usuarioId,
  empresa,
}: {
  orden: OrdenEditable;
  tecnicos: Tecnico[];
  rol: Rol;
  usuarioId: string;
  empresa: string;
}) {
  const router = useRouter();
  const [f, setF] = useState({
    tecnico_id: orden.tecnico_id ?? "",
    estado: orden.estado,
    costo: orden.costo != null ? String(Math.round(orden.costo)) : "",
    fecha_reparacion: orden.fecha_reparacion ?? "",
    comentario1: orden.comentario1 ?? "",
    comentario2: orden.comentario2 ?? "",
    observacion_final: orden.observacion_final ?? "",
  });
  const [fotos, setFotos] = useState(orden.fotos);
  const [nuevas, setNuevas] = useState<{ archivo: File; url: string }[]>([]);
  const [aviso, setAviso] = useState<{ cambios: CambioOrden[]; mensaje: string } | null>(null);
  const [error, setError] = useState<string>();
  const [confirmarEntrega, setConfirmarEntrega] = useState(false);
  const [guardando, iniciar] = useTransition();

  const editar = (c: Partial<typeof f>) => setF((a) => ({ ...a, ...c }));
  const cupo = MAX_FOTOS - fotos.length - nuevas.length;
  const nombreTecnico = (idT: string) => tecnicos.find((t) => t.usuario_id === idT)?.nombre ?? "Sin asignar";
  // Un técnico solo puede dejarse a sí mismo o sin asignar
  const opcionesTecnico = rol === "tecnico" ? tecnicos.filter((t) => t.usuario_id === usuarioId) : tecnicos;
  const tecnicoAsignado = tecnicos.find((t) => t.usuario_id === f.tecnico_id);

  async function agregarFotos(lista: FileList | null) {
    if (!lista) return;
    const archivos = await Promise.all([...lista].slice(0, Math.max(0, cupo)).map((a) => comprimirImagen(a, 1600)));
    setNuevas((n) => [...n, ...archivos.map((archivo) => ({ archivo, url: URL.createObjectURL(archivo) }))]);
  }

  function cambiosParaCliente(): CambioOrden[] {
    const cambios: CambioOrden[] = [];
    if (f.estado !== orden.estado) cambios.push({ campo: "Estado", antes: orden.estado, ahora: f.estado });
    const costoAntes = orden.costo != null ? String(Math.round(orden.costo)) : "";
    if (f.costo.replace(/\D/g, "") !== costoAntes && f.costo) cambios.push({ campo: "Costo", antes: costoAntes, ahora: f.costo.replace(/\D/g, "") });
    if (f.observacion_final.trim() !== (orden.observacion_final ?? "") && f.observacion_final.trim()) {
      cambios.push({ campo: "Informe del técnico", antes: orden.observacion_final ?? "", ahora: f.observacion_final.trim() });
    }
    return cambios;
  }

  function guardar() {
    setError(undefined);
    const datos = new FormData();
    datos.set("id", orden.id);
    for (const [k, v] of Object.entries(f)) datos.set(k, v);
    datos.set("fotos_existentes", JSON.stringify(fotos.map((x) => x.ruta)));
    for (const n of nuevas) datos.append("fotos_nuevas", n.archivo);
    const cambios = cambiosParaCliente();
    iniciar(async () => {
      const r = await actualizarOrden(datos);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setNuevas([]);
      router.refresh();
      setAviso({
        cambios,
        mensaje: cambios.length
          ? mensajeActualizacion({ empresa, cliente: orden.cliente, equipo: orden.equipo, codigo: orden.codigo, cambios })
          : "",
      });
    });
  }

  function entregar() {
    iniciar(async () => {
      const r = await entregarOrden(orden.id);
      setConfirmarEntrega(false);
      if (!r.ok) setError(r.error);
      else {
        editar({ estado: "ENTREGADO" });
        router.refresh();
      }
    });
  }

  const wa = aviso ? enlaceWhatsapp(orden.celular, aviso.mensaje) : null;
  const correo = aviso && orden.correo
    ? `mailto:${orden.correo}?subject=${encodeURIComponent(`${empresa} - Actualización de su equipo (${orden.codigo})`)}&body=${encodeURIComponent(aviso.mensaje)}`
    : null;

  return (
    <section className="space-y-5 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-900">🛠️ Ficha técnica</h2>
        {orden.estado === "LISTO" && (
          <button type="button" onClick={() => setConfirmarEntrega(true)} className={botonExito}>
            📦 Marcar como entregado
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className={`${etiqueta} lg:col-span-2`}>
          Técnico asignado
          <div className="flex gap-2">
            <select value={f.tecnico_id} onChange={(e) => editar({ tecnico_id: e.target.value })} className={campo}>
              <option value="">Sin asignar</option>
              {opcionesTecnico.map((t) => (
                <option key={t.usuario_id} value={t.usuario_id}>
                  {t.nombre}
                </option>
              ))}
              {/* El técnico actual aunque no esté en la lista visible */}
              {f.tecnico_id && !opcionesTecnico.some((t) => t.usuario_id === f.tecnico_id) && (
                <option value={f.tecnico_id}>{nombreTecnico(f.tecnico_id)}</option>
              )}
            </select>
            {tecnicoAsignado?.celular && (
              <a
                href={enlaceWhatsapp(tecnicoAsignado.celular, `Hola ${tecnicoAsignado.nombre}, tienes asignada la orden ${orden.codigo}: ${orden.equipo} de ${orden.cliente}.`) ?? "#"}
                target="_blank"
                rel="noreferrer"
                title="Avisar al técnico por WhatsApp"
                className="mt-1 flex items-center rounded-lg bg-green-600 px-3 text-white hover:bg-green-700"
              >
                📲
              </a>
            )}
          </div>
        </label>
        <label className={`${etiqueta} lg:col-span-2`}>
          Estado
          <select value={f.estado} onChange={(e) => editar({ estado: e.target.value as EstadoOrden })} className={campo}>
            {ESTADOS_ORDEN.map((e) => (
              <option key={e} value={e}>
                {ESTILO_ESTADO_ORDEN[e].icono} {ESTILO_ESTADO_ORDEN[e].texto}
              </option>
            ))}
          </select>
        </label>
        <label className={etiqueta}>
          Fecha diagnóstico / reparación
          <input type="date" value={f.fecha_reparacion} onChange={(e) => editar({ fecha_reparacion: e.target.value })} className={campo} />
        </label>
        <label className={etiqueta}>
          Costo de la reparación
          <input
            value={f.costo ? Number(f.costo.replace(/\D/g, "")).toLocaleString("es-CO") : ""}
            onChange={(e) => editar({ costo: e.target.value.replace(/\D/g, "") })}
            inputMode="numeric"
            placeholder="$ 0"
            className={`${campo} text-right tabular-nums`}
          />
        </label>
      </div>

      <div>
        <p className={etiqueta}>📷 Fotos del equipo ({fotos.length + nuevas.length}/{MAX_FOTOS})</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {fotos.map((x) => (
            <Miniatura key={x.ruta} url={x.url} alQuitar={() => setFotos((a) => a.filter((y) => y.ruta !== x.ruta))} />
          ))}
          {nuevas.map((x) => (
            <Miniatura key={x.url} url={x.url} nueva alQuitar={() => setNuevas((a) => a.filter((y) => y.url !== x.url))} />
          ))}
          {cupo > 0 && (
            <label className="flex size-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:border-violet-500 hover:text-violet-700">
              <span className="text-2xl">+</span>
              Agregar
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => agregarFotos(e.target.files)} />
            </label>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className={etiqueta}>
          📝 Bitácora · comentario 1
          <textarea
            value={f.comentario1}
            onChange={(e) => editar({ comentario1: e.target.value })}
            rows={3}
            placeholder="Ej: Se revisó la fuente de poder, pendiente prueba de carga..."
            className={campo}
          />
        </label>
        <label className={etiqueta}>
          📝 Bitácora · comentario 2
          <textarea
            value={f.comentario2}
            onChange={(e) => editar({ comentario2: e.target.value })}
            rows={3}
            placeholder="Ej: Se reemplazó el disco duro, equipo en pruebas finales..."
            className={campo}
          />
        </label>
      </div>

      <label className={etiqueta}>
        🔬 Observación final e informe de laboratorio
        <textarea
          value={f.observacion_final}
          onChange={(e) => editar({ observacion_final: e.target.value })}
          rows={4}
          className={campo}
          placeholder="Diagnóstico, trabajo realizado y recomendaciones para el cliente"
        />
      </label>

      <div className="flex justify-end">
        <button type="button" onClick={guardar} disabled={guardando} className={`${botonPrimario} bg-violet-700 px-6 py-2.5 hover:bg-violet-800`}>
          {guardando ? "Guardando..." : "Guardar ficha técnica"}
        </button>
      </div>

      {/* Aviso al cliente después de guardar */}
      <Dialogo
        abierto={aviso !== null}
        tono="exito"
        titulo="Ficha guardada"
        alCerrar={() => setAviso(null)}
        acciones={
          <>
            <button type="button" className={botonSecundario} onClick={() => setAviso(null)}>
              {aviso?.cambios.length ? "No avisar" : "Cerrar"}
            </button>
            {correo && (
              <a href={correo} className={botonSecundario}>
                ✉️ Correo
              </a>
            )}
            {wa && aviso?.cambios.length ? (
              <a href={wa} target="_blank" rel="noreferrer" className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
                📲 Avisar por WhatsApp
              </a>
            ) : null}
          </>
        }
      >
        {aviso?.cambios.length ? (
          <>
            <p>Cambios que le interesan al cliente:</p>
            <ul className="list-inside list-disc">
              {aviso.cambios.map((c) => (
                <li key={c.campo}>
                  {c.campo}: <strong>{c.campo === "Costo" ? pesos(Number(c.ahora)) : c.campo === "Estado" ? ESTILO_ESTADO_ORDEN[c.ahora as EstadoOrden].texto : c.ahora}</strong>
                </li>
              ))}
            </ul>
            <label className="block text-xs font-medium text-slate-600">
              Mensaje para el cliente (puede editarlo)
              <textarea
                value={aviso.mensaje}
                onChange={(e) => setAviso({ ...aviso, mensaje: e.target.value })}
                rows={9}
                className={`${campo} text-sm`}
              />
            </label>
          </>
        ) : (
          <p>Los cambios quedaron guardados.</p>
        )}
      </Dialogo>

      <Dialogo
        abierto={confirmarEntrega}
        titulo="¿Entregar el equipo al cliente?"
        alCerrar={() => setConfirmarEntrega(false)}
        acciones={
          <>
            <button type="button" className={botonSecundario} onClick={() => setConfirmarEntrega(false)}>
              Cancelar
            </button>
            <button type="button" className={botonExito} onClick={entregar} disabled={guardando}>
              {guardando ? "Guardando..." : "Sí, entregado"}
            </button>
          </>
        }
      >
        <p>
          Verifique que el cliente presente el código <strong className="font-mono">{orden.codigo}</strong>. La orden quedará
          archivada como entregada.
        </p>
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

function Miniatura({ url, nueva, alQuitar }: { url: string; nueva?: boolean; alQuitar: () => void }) {
  return (
    <div className="relative">
      <a href={url} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada o vista previa local */}
        <img src={url} alt="Foto del equipo" className={`size-24 rounded-lg object-cover ring-2 ${nueva ? "ring-violet-400" : "ring-slate-200"}`} />
      </a>
      <button
        type="button"
        onClick={alQuitar}
        aria-label="Quitar foto"
        className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-red-600 text-xs text-white shadow"
      >
        ✕
      </button>
      {nueva && <span className="absolute bottom-1 left-1 rounded bg-violet-700 px-1 text-[10px] text-white">nueva</span>}
    </div>
  );
}
