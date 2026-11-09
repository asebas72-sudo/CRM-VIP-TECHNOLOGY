"use client";

import { useState, useTransition } from "react";
import { botonPrimario, botonSecundario } from "@/components/dialogo";
import { pesos } from "@/lib/formato";
import { actualizarServicio, cambiarEstadoServicio, crearServicio, type DatosServicio } from "./acciones";

export type Servicio = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion_comercial: string | null;
  precio_venta: number;
  iva_porcentaje: number;
  publicar_portafolio: boolean;
  activo: boolean;
};

const campo = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const etiqueta = "block text-sm font-medium text-slate-700";
const VACIO: DatosServicio = { nombre: "", descripcion: "", precio: 0, iva: 19, publicar: true };

function Formulario({
  inicial,
  textoBoton,
  alGuardar,
  alCancelar,
  children,
}: {
  inicial: DatosServicio;
  textoBoton: string;
  alGuardar: (d: DatosServicio) => Promise<{ error?: string; resumen?: string }>;
  alCancelar?: () => void;
  children?: React.ReactNode;
}) {
  const [d, setD] = useState(inicial);
  const [precio, setPrecio] = useState(inicial.precio ? String(inicial.precio) : "");
  const [error, setError] = useState<string>();
  const [resumen, setResumen] = useState<string>();
  const [guardando, iniciar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setResumen(undefined);
    iniciar(async () => {
      const r = await alGuardar({ ...d, precio: Number(precio.replace(/\D/g, "")) });
      setResumen(r.resumen);
      if (r.error) setError(r.error);
      else if (!alCancelar) {
        setD(VACIO);
        setPrecio("");
      } else alCancelar();
    });
  }

  return (
    <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-[1fr_160px_100px]">
      <label className={etiqueta}>
        Nombre del servicio *
        <input required value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} className={`${campo} mt-1`} />
      </label>
      <label className={etiqueta}>
        Precio (IVA incluido) *
        <input
          required
          inputMode="numeric"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          placeholder="0"
          className={`${campo} mt-1 text-right`}
        />
      </label>
      <label className={etiqueta}>
        IVA
        <select value={d.iva} onChange={(e) => setD({ ...d, iva: Number(e.target.value) })} className={`${campo} mt-1`}>
          {[0, 5, 19].map((v) => (
            <option key={v} value={v}>
              {v}%
            </option>
          ))}
        </select>
      </label>
      <label className={`${etiqueta} sm:col-span-3`}>
        Descripción para el portafolio
        <textarea
          rows={2}
          value={d.descripcion}
          onChange={(e) => setD({ ...d, descripcion: e.target.value })}
          className={`${campo} mt-1`}
        />
      </label>
      {children && <div className="sm:col-span-3">{children}</div>}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={d.publicar} onChange={(e) => setD({ ...d, publicar: e.target.checked })} className="size-4" />
          Mostrar en el portafolio
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {resumen && <span className="text-sm text-green-700">{resumen}</span>}
          {error && <span className="text-sm text-red-700">{error}</span>}
          {alCancelar && (
            <button type="button" onClick={alCancelar} className={botonSecundario}>
              Cancelar
            </button>
          )}
          <button disabled={guardando} className={botonPrimario}>
            {guardando ? "Guardando..." : textoBoton}
          </button>
        </div>
      </div>
    </form>
  );
}

function Fila({ s }: { s: Servicio }) {
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState<string>();
  const [cambiando, iniciar] = useTransition();

  if (editando) {
    return (
      <li className="p-4">
        <Formulario
          inicial={{
            nombre: s.nombre,
            descripcion: s.descripcion_comercial ?? "",
            precio: Number(s.precio_venta),
            iva: Number(s.iva_porcentaje),
            publicar: s.publicar_portafolio,
          }}
          textoBoton="Guardar cambios"
          alGuardar={(d) => actualizarServicio(s.id, d)}
          alCancelar={() => setEditando(false)}
        />
      </li>
    );
  }

  return (
    <li className={`flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 ${s.activo ? "" : "opacity-60"}`}>
      <div className="min-w-56 flex-1">
        <p className="font-medium text-slate-900">{s.nombre}</p>
        <p className="text-xs text-slate-500">
          <span className="font-mono">{s.codigo}</span> · IVA {Number(s.iva_porcentaje)}%
          {s.publicar_portafolio && s.activo && " · En portafolio"}
          {!s.activo && " · Inactivo"}
        </p>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
      <span className="font-semibold tabular-nums">{pesos(s.precio_venta)}</span>
      <div className="flex gap-2">
        <button onClick={() => setEditando(true)} className={botonSecundario}>
          Editar
        </button>
        <button
          disabled={cambiando}
          onClick={() =>
            iniciar(async () => {
              const r = await cambiarEstadoServicio(s.id, !s.activo);
              setError(r.error);
            })
          }
          className={botonSecundario}
        >
          {s.activo ? "Desactivar" : "Activar"}
        </button>
      </div>
    </li>
  );
}

/** Cada creación pide de nuevo las empresas, para no cargar un servicio donde no corresponde. */
function NuevoServicio({ empresas }: { empresas: { id: string; nombre: string }[] }) {
  const inicial = empresas.length === 1 ? [empresas[0].id] : [];
  const [elegidas, setElegidas] = useState<string[]>(inicial);
  const todas = elegidas.length === empresas.length;

  async function guardar(d: DatosServicio) {
    const r = await crearServicio(d, elegidas);
    if (!r.error) setElegidas(inicial);
    return r;
  }

  return (
    <Formulario inicial={VACIO} textoBoton="Crear servicio" alGuardar={guardar}>
      <fieldset>
        <legend className={etiqueta}>Crear en *</legend>
        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-700">
          {empresas.length > 1 && (
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={todas}
                onChange={(e) => setElegidas(e.target.checked ? empresas.map((x) => x.id) : [])}
                className="size-4"
              />
              Todas las empresas
            </label>
          )}
          {empresas.map((x) => (
            <label key={x.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={elegidas.includes(x.id)}
                onChange={(e) => setElegidas((a) => (e.target.checked ? [...a, x.id] : a.filter((id) => id !== x.id)))}
                className="size-4"
              />
              {x.nombre}
            </label>
          ))}
        </div>
      </fieldset>
    </Formulario>
  );
}

export function ListaServicios({ servicios, empresas }: { servicios: Servicio[]; empresas: { id: string; nombre: string }[] }) {
  return (
    <>
      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="mb-3 font-semibold text-slate-900">Nuevo servicio</h2>
        <NuevoServicio empresas={empresas} />
      </div>
      {servicios.length === 0 ? (
        <p className="rounded-2xl bg-white p-10 text-center text-slate-500 ring-1 ring-slate-200">Todavía no hay servicios creados.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
          {servicios.map((s) => (
            <Fila key={s.id} s={s} />
          ))}
        </ul>
      )}
    </>
  );
}
