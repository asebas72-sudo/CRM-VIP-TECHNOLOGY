"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { botonPrimario, Dialogo } from "@/components/dialogo";
import {
  aplicarPlantilla,
  GRUPOS_PLANTILLAS,
  PLANTILLAS_DEFECTO,
  VARIABLES_ASESORIA,
  VARIABLES_ORDEN,
  type ClavePlantilla,
  type Plantillas,
} from "@/lib/servicio";
import { guardarConfiguracionServicio } from "../acciones";
import { campo, etiqueta } from "../cliente-campos";

type EmpresaConfig = { id: string; nombre: string; valorRevision: number; diasEntrega: number; plantillas: Plantillas };

/** Valores de ejemplo para la vista previa de cada mensaje */
const EJEMPLO = {
  cliente: "Carlos Pérez",
  celular: "3001234567",
  equipo: "Portátil HP 15 gris",
  codigo: "03CA10RL45H153012",
  orden: 128,
  numero: 42,
  estado: "En proceso",
  costo: "$180.000",
  informe: "Se cambió el disco duro por un SSD de 480 GB.",
  fallas: "No enciende",
  fecha_ingreso: "03/11/2026",
  fecha_entrega: "11/11/2026",
  tecnico: "Andrés",
  solicitud: "Instalación CCTV",
  detalle: "4 cámaras en local de 2 pisos",
  fecha_visita: "viernes, 7 de noviembre de 2026, 3:00 p. m.",
};

export function EditorConfiguracion({ empresas }: { empresas: EmpresaConfig[] }) {
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState(empresas[0].id);
  const empresa = empresas.find((e) => e.id === empresaId)!;

  return (
    <div className="space-y-6">
      {empresas.length > 1 && (
        <label className={`${etiqueta} max-w-sm`}>
          Empresa que está configurando
          <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className={`${campo} font-semibold`}>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </label>
      )}
      {/* key: al cambiar de empresa se cargan sus textos */}
      <Formulario key={empresa.id} empresa={empresa} alGuardar={() => router.refresh()} />
    </div>
  );
}

function Formulario({ empresa, alGuardar }: { empresa: EmpresaConfig; alGuardar: () => void }) {
  const [textos, setTextos] = useState<Plantillas>(empresa.plantillas);
  const [valor, setValor] = useState(String(empresa.valorRevision));
  const [dias, setDias] = useState(String(empresa.diasEntrega));
  const [resultado, setResultado] = useState<{ ok: boolean; error?: string } | null>(null);
  const [guardando, iniciar] = useTransition();

  function guardar() {
    // Solo se guardan los textos que difieren del original
    const personalizados: Partial<Plantillas> = {};
    for (const clave of Object.keys(textos) as ClavePlantilla[]) {
      if (textos[clave].trim() && textos[clave] !== PLANTILLAS_DEFECTO[clave]) personalizados[clave] = textos[clave];
    }
    const datos = new FormData();
    datos.set("empresa_id", empresa.id);
    datos.set("valor_revision", valor);
    datos.set("dias_entrega", dias);
    datos.set("mensajes", JSON.stringify(personalizados));
    iniciar(async () => {
      const r = await guardarConfiguracionServicio(datos);
      setResultado(r);
      if (r.ok) alGuardar();
    });
  }

  const valorRevision = `$${Number(valor.replace(/\D/g, "") || 0).toLocaleString("es-CO")}`;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:grid-cols-2 lg:max-w-2xl">
        <h2 className="font-semibold text-slate-900 sm:col-span-2">Servicio en {empresa.nombre}</h2>
        <label className={etiqueta}>
          Valor de la revisión
          <input
            value={Number(valor.replace(/\D/g, "") || 0).toLocaleString("es-CO")}
            onChange={(e) => setValor(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            className={`${campo} text-right tabular-nums`}
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">Variable {"{valor_revision}"} y ficha de ingreso.</span>
        </label>
        <label className={etiqueta}>
          Días estimados de entrega
          <input value={dias} onChange={(e) => setDias(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={campo} />
          <span className="mt-1 block text-xs font-normal text-slate-500">Se suman a la fecha de ingreso.</span>
        </label>
      </section>

      <div className="rounded-xl bg-violet-50 p-4 text-sm text-violet-900 ring-1 ring-violet-200">
        <p className="font-semibold">¿Cómo funcionan los mensajes?</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5">
          <li>Las palabras entre llaves, como {"{cliente}"} o {"{codigo}"}, se reemplazan con los datos reales.</li>
          <li>Si un dato no existe todavía (por ejemplo el costo), la línea que lo contiene no se envía.</li>
          <li>
            Para negrita en WhatsApp use *asteriscos*. Al enviar, el mensaje se puede editar antes de mandarlo.
          </li>
        </ul>
      </div>

      {GRUPOS_PLANTILLAS.map((g) => (
        <section key={g.titulo} className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">{g.titulo}</h2>
          {g.plantillas.map((p) => (
            <EditorPlantilla
              key={p.clave}
              titulo={p.texto}
              ayuda={p.ayuda}
              texto={textos[p.clave]}
              original={PLANTILLAS_DEFECTO[p.clave]}
              variables={p.clave.startsWith("ORDEN") ? VARIABLES_ORDEN : VARIABLES_ASESORIA}
              alCambiar={(t) => setTextos((a) => ({ ...a, [p.clave]: t }))}
              ejemplo={{ ...EJEMPLO, empresa: empresa.nombre, valor_revision: valorRevision }}
            />
          ))}
        </section>
      ))}

      <div className="sticky bottom-4 flex justify-end">
        <button type="button" onClick={guardar} disabled={guardando} className={`${botonPrimario} bg-violet-700 px-8 py-3 text-base shadow-lg hover:bg-violet-800`}>
          {guardando ? "Guardando..." : "Guardar configuración"}
        </button>
      </div>

      <Dialogo
        abierto={resultado !== null}
        tono={resultado?.ok ? "exito" : "error"}
        titulo={resultado?.ok ? "Configuración guardada" : "No se pudo guardar"}
        alCerrar={() => setResultado(null)}
        acciones={
          <button type="button" className={botonPrimario} onClick={() => setResultado(null)}>
            Entendido
          </button>
        }
      >
        <p>{resultado?.ok ? `Los mensajes de ${empresa.nombre} ya usan los nuevos textos.` : resultado?.error}</p>
      </Dialogo>
    </div>
  );
}

function EditorPlantilla({
  titulo,
  ayuda,
  texto,
  original,
  variables,
  alCambiar,
  ejemplo,
}: {
  titulo: string;
  ayuda: string;
  texto: string;
  original: string;
  variables: string[];
  alCambiar: (t: string) => void;
  ejemplo: Record<string, string | number>;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const personalizado = texto !== original;

  // Inserta la variable donde está el cursor
  function insertar(variable: string) {
    const el = area.current;
    if (!el) return alCambiar(texto + variable);
    const inicio = el.selectionStart ?? texto.length;
    const fin = el.selectionEnd ?? texto.length;
    alCambiar(texto.slice(0, inicio) + variable + texto.slice(fin));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(inicio + variable.length, inicio + variable.length);
    });
  }

  return (
    <div className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 lg:grid-cols-2">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-slate-900">
            {titulo}
            {personalizado && <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">Personalizado</span>}
          </p>
          {personalizado && (
            <button type="button" onClick={() => alCambiar(original)} className="text-xs font-medium text-slate-500 hover:text-red-600">
              Restaurar texto original
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500">{ayuda}</p>
        <textarea ref={area} value={texto} onChange={(e) => alCambiar(e.target.value)} rows={10} className={`${campo} font-mono text-sm`} />
        <div className="flex flex-wrap gap-1">
          {variables.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => insertar(v)}
              className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700 hover:bg-violet-100 hover:text-violet-800"
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Vista previa (datos de ejemplo)</p>
        <div className="mt-2 rounded-xl bg-[#e7ddd4] p-3">
          <p className="max-w-md rounded-lg rounded-tl-none bg-white px-3 py-2 text-sm whitespace-pre-line text-slate-900 shadow-sm">
            {aplicarPlantilla(texto, ejemplo) || "(mensaje vacío)"}
          </p>
        </div>
      </div>
    </div>
  );
}
