"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { botonPrimario, botonSecundario, Dialogo } from "@/components/dialogo";
import { Firma, type FirmaRef } from "@/components/firma";
import { comprimirImagen } from "@/lib/imagenes";
import { ACCESORIOS, enlaceWhatsapp, mensajeIngreso, TIPOS_EQUIPO } from "@/lib/servicio";
import { crearOrden, type ResultadoIngreso } from "../acciones";
import { campo, CamposCliente, etiqueta } from "../cliente-campos";

export function FormularioIngreso({
  marcas,
  empresa,
  valorRevision,
}: {
  marcas: string[];
  empresa: string;
  valorRevision: number;
}) {
  const formulario = useRef<HTMLFormElement>(null);
  const firma = useRef<FirmaRef>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [vistaFoto, setVistaFoto] = useState<string | null>(null);
  const [marcaNueva, setMarcaNueva] = useState(false);
  const [resultado, setResultado] = useState<ResultadoIngreso | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [guardando, iniciar] = useTransition();

  async function elegirFoto(f: File | undefined) {
    if (!f) return;
    const lista = await comprimirImagen(f, 1600);
    setFoto(lista);
    setVistaFoto(URL.createObjectURL(lista));
  }

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    datos.delete("foto_archivo");
    if (foto) datos.set("foto", foto);
    const f = firma.current?.obtener();
    if (f) datos.set("firma", f);
    iniciar(async () => {
      const r = await crearOrden(datos);
      setResultado(r);
      if (r.ok) {
        setMensaje(
          mensajeIngreso({
            empresa,
            nombre: r.nombre,
            equipo: r.equipo,
            codigo: r.codigo,
            fechaIngreso: r.fechaIngreso,
            valorRevision,
          }),
        );
      }
    });
  }

  function nuevo() {
    formulario.current?.reset();
    firma.current?.limpiar();
    setFoto(null);
    setVistaFoto(null);
    setMarcaNueva(false);
    setResultado(null);
    window.scrollTo({ top: 0 });
  }

  const wa = resultado?.ok ? enlaceWhatsapp(resultado.celular, mensaje) : null;

  return (
    <form ref={formulario} onSubmit={enviar} className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <section className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="font-semibold text-slate-900">1. Cliente</h2>
          <CamposCliente />
        </section>

        <section className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="font-semibold text-slate-900">2. Equipo</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className={`${etiqueta} sm:col-span-3`}>
              Equipo (descripción) *
              <input name="equipo" required placeholder="Ej: Portátil HP 15 gris, serial 5CD12..." className={campo} />
            </label>
            <label className={etiqueta}>
              Tipo *
              <select name="tipo" required defaultValue="" className={campo}>
                <option value="" disabled>
                  Seleccione...
                </option>
                {TIPOS_EQUIPO.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <div className={`${etiqueta} sm:col-span-2`}>
              <div className="flex justify-between">
                Marca *
                <button type="button" onClick={() => setMarcaNueva(!marcaNueva)} className="text-xs font-normal text-violet-700 hover:underline">
                  {marcaNueva ? "Elegir de la lista" : "+ Otra marca"}
                </button>
              </div>
              {marcaNueva ? (
                <input name="marca" required placeholder="Escriba la marca" className={campo} autoFocus />
              ) : (
                <select name="marca" required defaultValue="" className={campo}>
                  <option value="" disabled>
                    Seleccione...
                  </option>
                  {marcas.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <fieldset>
            <legend className={etiqueta}>Accesorios que entrega el cliente</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {ACCESORIOS.map((a) => (
                <label
                  key={a}
                  className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-sm has-[:checked]:border-violet-600 has-[:checked]:bg-violet-50 has-[:checked]:text-violet-800"
                >
                  <input type="checkbox" name="accesorios" value={a} className="accent-violet-700" />
                  {a}
                </label>
              ))}
            </div>
          </fieldset>

          <label className={etiqueta}>
            Fallas que reporta el cliente
            <textarea name="fallas" rows={3} className={campo} placeholder="Ej: No enciende, pantalla con rayas..." />
          </label>
          <label className={etiqueta}>
            Observaciones del estado físico
            <textarea name="observaciones" rows={2} className={campo} placeholder="Ej: Golpe en la esquina, falta tornillo..." />
          </label>
        </section>
      </div>

      <div className="space-y-6">
        <section className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="font-semibold text-slate-900">3. Foto del equipo</h2>
          <input
            name="foto_archivo"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => elegirFoto(e.target.files?.[0])}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-white"
          />
          {vistaFoto && (
            // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:)
            <img src={vistaFoto} alt="Foto del equipo" className="max-h-56 w-full rounded-lg object-contain ring-1 ring-slate-200" />
          )}
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="font-semibold text-slate-900">4. Firma del cliente</h2>
          <p className="text-xs text-slate-500">
            Con su firma el cliente acepta que toda revisión cuesta ${valorRevision.toLocaleString("es-CO")} si no desea la
            reparación, y que el equipo debe reclamarse en menos de 30 días.
          </p>
          <Firma ref={firma} />
        </section>

        <button disabled={guardando} className="w-full rounded-xl bg-violet-700 py-3 text-lg font-semibold text-white hover:bg-violet-800 disabled:opacity-60">
          {guardando ? "Registrando..." : "Registrar ingreso"}
        </button>
      </div>

      <Dialogo
        abierto={resultado?.ok === true}
        tono="exito"
        titulo="Equipo registrado"
        acciones={
          resultado?.ok ? (
            <>
              <button type="button" className={botonSecundario} onClick={nuevo}>
                Nuevo ingreso
              </button>
              <Link href={`/servicio/${resultado.id}/ficha?imprimir=1`} className={botonSecundario}>
                Imprimir ficha
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
        {resultado?.ok && (
          <>
            <p className="rounded-lg bg-violet-50 px-3 py-2 text-center">
              <span className="block text-xs text-violet-700 uppercase">Código del caso · Orden #{resultado.consecutivo}</span>
              <span className="font-mono text-2xl font-bold text-violet-800">{resultado.codigo}</span>
            </p>
            <p>
              {resultado.nombre} · {resultado.equipo}
              <br />
              Ingreso {resultado.fechaIngreso} · entrega estimada <strong>{resultado.fechaEntrega}</strong>
            </p>
            <label className="block text-xs font-medium text-slate-600">
              Mensaje para el cliente (puede editarlo)
              <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={8} className={`${campo} text-sm`} />
            </label>
            <Link href={`/servicio/${resultado.id}`} className="text-sm font-medium text-violet-700 hover:underline">
              Ver la orden →
            </Link>
          </>
        )}
      </Dialogo>

      <Dialogo
        abierto={resultado?.ok === false}
        tono="error"
        titulo="No se pudo registrar el ingreso"
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
