"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { botonPrimario, botonSecundario, Dialogo } from "@/components/dialogo";
import { comprimirImagen } from "@/lib/imagenes";
import { enlaceWhatsapp, mensajeAsesoriaCliente, SOLICITUDES_ASESORIA } from "@/lib/servicio";
import { crearAsesoria, type ResultadoAsesoria } from "../../acciones";
import { campo, CamposCliente, etiqueta } from "../../cliente-campos";

export function FormularioAsesoria({ empresa }: { empresa: string }) {
  const formulario = useRef<HTMLFormElement>(null);
  const [imagen, setImagen] = useState<File | null>(null);
  const [resultado, setResultado] = useState<ResultadoAsesoria | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [guardando, iniciar] = useTransition();

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    datos.delete("imagen_archivo");
    if (imagen) datos.set("imagen", imagen);
    iniciar(async () => {
      const r = await crearAsesoria(datos);
      setResultado(r);
      if (r.ok) setMensaje(mensajeAsesoriaCliente({ empresa, nombre: r.nombre, numero: r.consecutivo, solicitud: r.solicitud }));
    });
  }

  function nueva() {
    formulario.current?.reset();
    setImagen(null);
    setResultado(null);
  }

  const wa = resultado?.ok ? enlaceWhatsapp(resultado.celular, mensaje) : null;

  return (
    <form ref={formulario} onSubmit={enviar} className="max-w-3xl space-y-6">
      <section className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="font-semibold text-slate-900">1. Cliente</h2>
        <CamposCliente />
      </section>

      <section className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="font-semibold text-slate-900">2. Solicitud</h2>
        <label className={etiqueta}>
          Tipo de asesoría *
          <select name="solicitud" required defaultValue="" className={campo}>
            <option value="" disabled>
              Seleccione...
            </option>
            {SOLICITUDES_ASESORIA.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className={etiqueta}>
          Detalle de lo que necesita
          <textarea name="fallas" rows={3} className={campo} placeholder="Ej: Instalar 4 cámaras en local comercial, 2 pisos..." />
        </label>
        <label className={etiqueta}>
          Observaciones (dirección, horario preferido...)
          <textarea name="observaciones" rows={2} className={campo} />
        </label>
        <label className={etiqueta}>
          Foto de referencia (opcional)
          <input
            name="imagen_archivo"
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              setImagen(f ? await comprimirImagen(f, 1600) : null);
            }}
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-white"
          />
        </label>
      </section>

      <button disabled={guardando} className="rounded-xl bg-violet-700 px-8 py-3 text-lg font-semibold text-white hover:bg-violet-800 disabled:opacity-60">
        {guardando ? "Registrando..." : "Registrar asesoría"}
      </button>

      <Dialogo
        abierto={resultado?.ok === true}
        tono="exito"
        titulo={resultado?.ok ? `Asesoría #${resultado.consecutivo} registrada` : ""}
        acciones={
          resultado?.ok ? (
            <>
              <button type="button" className={botonSecundario} onClick={nueva}>
                Nueva asesoría
              </button>
              <Link href={`/servicio/asesorias/${resultado.id}`} className={botonSecundario}>
                Agendar visita
              </Link>
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer" className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
                  📲 Enviar por WhatsApp
                </a>
              )}
            </>
          ) : null
        }
      >
        <label className="block text-xs font-medium text-slate-600">
          Mensaje para el cliente (puede editarlo)
          <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={8} className={`${campo} text-sm`} />
        </label>
      </Dialogo>

      <Dialogo
        abierto={resultado?.ok === false}
        tono="error"
        titulo="No se pudo registrar la asesoría"
        alCerrar={() => setResultado(null)}
        acciones={
          <button type="button" className={botonPrimario} onClick={() => setResultado(null)}>
            Entendido
          </button>
        }
      >
        <p>{resultado && !resultado.ok ? resultado.error : ""}</p>
      </Dialogo>
    </form>
  );
}
