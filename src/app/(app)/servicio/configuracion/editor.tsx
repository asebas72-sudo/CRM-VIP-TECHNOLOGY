"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
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

export type EmpresaConfig = { id: string; nombre: string; valorRevision: number; diasEntrega: number; plantillas: Plantillas };

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

const pesos = (v: string | number) => `$${Number(String(v).replace(/\D/g, "") || 0).toLocaleString("es-CO")}`;

/** Selector de empresa (si administra varias) + el formulario de esa empresa. */
function PorEmpresa({ empresas, children }: { empresas: EmpresaConfig[]; children: (e: EmpresaConfig) => ReactNode }) {
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
      {/* key: al cambiar de empresa se cargan sus valores */}
      <div key={empresa.id}>{children(empresa)}</div>
    </div>
  );
}

function useGuardar(empresa: EmpresaConfig) {
  const router = useRouter();
  const [resultado, setResultado] = useState<{ ok: boolean; error?: string } | null>(null);
  const [guardando, iniciar] = useTransition();

  function guardar(datos: Record<string, string>) {
    const form = new FormData();
    form.set("empresa_id", empresa.id);
    for (const [k, v] of Object.entries(datos)) form.set(k, v);
    iniciar(async () => {
      const r = await guardarConfiguracionServicio(form);
      setResultado(r);
      if (r.ok) router.refresh();
    });
  }

  const aviso = (textoOk: string) => (
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
      <p>{resultado?.ok ? textoOk : resultado?.error}</p>
    </Dialogo>
  );

  return { guardar, guardando, aviso };
}

// ---------------------------------------------------------------------
// Ajustes generales del servicio técnico
// ---------------------------------------------------------------------

export function AjustesServicio({ empresas }: { empresas: EmpresaConfig[] }) {
  return <PorEmpresa empresas={empresas}>{(e) => <FormularioAjustes empresa={e} />}</PorEmpresa>;
}

function FormularioAjustes({ empresa }: { empresa: EmpresaConfig }) {
  const [valor, setValor] = useState(String(empresa.valorRevision));
  const [dias, setDias] = useState(String(empresa.diasEntrega));
  const { guardar, guardando, aviso } = useGuardar(empresa);

  return (
    <section className="grid max-w-2xl gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:grid-cols-2">
      <h2 className="font-semibold text-slate-900 sm:col-span-2">Servicio en {empresa.nombre}</h2>
      <label className={etiqueta}>
        Valor de la revisión
        <input
          value={Number(valor || 0).toLocaleString("es-CO")}
          onChange={(e) => setValor(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          className={`${campo} text-right tabular-nums`}
        />
        <span className="mt-1 block text-xs font-normal text-slate-500">
          Sale en la ficha de ingreso y en los mensajes con {"{valor_revision}"}.
        </span>
      </label>
      <label className={etiqueta}>
        Días estimados de entrega
        <input value={dias} onChange={(e) => setDias(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={campo} />
        <span className="mt-1 block text-xs font-normal text-slate-500">Se suman a la fecha de ingreso de cada equipo.</span>
      </label>
      <div className="sm:col-span-2">
        <button
          type="button"
          onClick={() => guardar({ valor_revision: valor, dias_entrega: dias })}
          disabled={guardando}
          className={`${botonPrimario} bg-violet-700 px-6 hover:bg-violet-800`}
        >
          {guardando ? "Guardando..." : "Guardar"}
        </button>
      </div>
      {aviso(`Los ajustes de ${empresa.nombre} quedaron guardados.`)}
    </section>
  );
}

// ---------------------------------------------------------------------
// Mensajes de WhatsApp (acordeón por grupo y por mensaje)
// ---------------------------------------------------------------------

export function MensajesServicio({ empresas }: { empresas: EmpresaConfig[] }) {
  return <PorEmpresa empresas={empresas}>{(e) => <FormularioMensajes empresa={e} />}</PorEmpresa>;
}

function FormularioMensajes({ empresa }: { empresa: EmpresaConfig }) {
  const [textos, setTextos] = useState<Plantillas>(empresa.plantillas);
  const { guardar, guardando, aviso } = useGuardar(empresa);
  const ejemplo = { ...EJEMPLO, empresa: empresa.nombre, valor_revision: pesos(empresa.valorRevision) };
  const pendientes = (Object.keys(textos) as ClavePlantilla[]).some((c) => textos[c] !== empresa.plantillas[c]);

  function enviar() {
    // Solo se guardan los textos que difieren del original
    const personalizados: Partial<Plantillas> = {};
    for (const clave of Object.keys(textos) as ClavePlantilla[]) {
      if (textos[clave].trim() && textos[clave] !== PLANTILLAS_DEFECTO[clave]) personalizados[clave] = textos[clave];
    }
    guardar({ mensajes: JSON.stringify(personalizados) });
  }

  return (
    <div className="space-y-4">
      <details className="rounded-xl bg-violet-50 p-4 text-sm text-violet-900 ring-1 ring-violet-200">
        <summary className="cursor-pointer font-semibold">¿Cómo funcionan los mensajes?</summary>
        <ul className="mt-2 list-inside list-disc space-y-0.5">
          <li>Las palabras entre llaves, como {"{cliente}"} o {"{codigo}"}, se reemplazan con los datos reales.</li>
          <li>Si un dato no existe todavía (por ejemplo el costo), la línea que lo contiene no se envía.</li>
          <li>Para negrita en WhatsApp use *asteriscos*. Al enviar, el mensaje se puede editar antes de mandarlo.</li>
        </ul>
      </details>

      {GRUPOS_PLANTILLAS.map((g) => {
        const personalizados = g.plantillas.filter((p) => textos[p.clave] !== PLANTILLAS_DEFECTO[p.clave]).length;
        return (
          <details key={g.titulo} className="group rounded-2xl bg-white ring-1 ring-slate-200">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
              <span className="font-bold text-slate-900">{g.titulo}</span>
              <span className="flex items-center gap-3 text-xs text-slate-500">
                {g.plantillas.length} mensaje(s){personalizados > 0 && ` · ${personalizados} personalizado(s)`}
                <span className="transition group-open:rotate-90">▶</span>
              </span>
            </summary>
            <div className="space-y-2 border-t border-slate-100 p-3">
              {g.plantillas.map((p) => (
                <EditorPlantilla
                  key={p.clave}
                  titulo={p.texto}
                  ayuda={p.ayuda}
                  texto={textos[p.clave]}
                  original={PLANTILLAS_DEFECTO[p.clave]}
                  variables={p.clave.startsWith("ORDEN") ? VARIABLES_ORDEN : VARIABLES_ASESORIA}
                  alCambiar={(t) => setTextos((a) => ({ ...a, [p.clave]: t }))}
                  ejemplo={ejemplo}
                />
              ))}
            </div>
          </details>
        );
      })}

      <div className="sticky bottom-4 flex items-center justify-end gap-3">
        {pendientes && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Cambios sin guardar</span>}
        <button type="button" onClick={enviar} disabled={guardando} className={`${botonPrimario} bg-violet-700 px-8 py-3 text-base shadow-lg hover:bg-violet-800`}>
          {guardando ? "Guardando..." : "Guardar mensajes"}
        </button>
      </div>
      {aviso(`Los mensajes de ${empresa.nombre} ya usan los nuevos textos.`)}
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
    <details className="group/mensaje rounded-xl ring-1 ring-slate-200 open:bg-slate-50">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
        <span>
          <span className="font-semibold text-slate-900">{titulo}</span>
          {personalizado && (
            <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">Personalizado</span>
          )}
          <span className="block text-xs text-slate-500">{ayuda}</span>
        </span>
        <span className="text-xs text-slate-400 transition group-open/mensaje:rotate-90">▶</span>
      </summary>

      <div className="grid gap-4 border-t border-slate-200 p-4 lg:grid-cols-2">
        <div className="space-y-2">
          <textarea ref={area} value={texto} onChange={(e) => alCambiar(e.target.value)} rows={10} className={`${campo} font-mono text-sm`} />
          <div className="flex flex-wrap gap-1">
            {variables.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertar(v)}
                className="rounded-md bg-white px-2 py-0.5 font-mono text-xs text-slate-700 ring-1 ring-slate-200 hover:bg-violet-100 hover:text-violet-800"
              >
                {v}
              </button>
            ))}
          </div>
          {personalizado && (
            <button type="button" onClick={() => alCambiar(original)} className="text-xs font-medium text-slate-500 hover:text-red-600">
              Restaurar texto original
            </button>
          )}
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
    </details>
  );
}
