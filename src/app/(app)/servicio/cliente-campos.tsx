"use client";

import { useState, useTransition } from "react";
import { buscarClientePorCedula } from "./acciones";

export const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/20";
export const etiqueta = "block text-sm font-medium text-slate-700";

/** Cédula, nombre, celular y correo; al escribir la cédula se autocompletan los datos del cliente conocido. */
export function CamposCliente({ empresaId }: { empresaId: string }) {
  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [correo, setCorreo] = useState("");
  const [aviso, setAviso] = useState("");
  const [buscando, iniciar] = useTransition();

  function buscar(cedula: string) {
    iniciar(async () => {
      const c = await buscarClientePorCedula(cedula, empresaId);
      if (c) {
        setNombre(c.nombre);
        setCelular(c.telefono ?? "");
        setCorreo(c.correo ?? "");
        setAviso("Cliente encontrado: se cargaron sus datos.");
      } else {
        setAviso(cedula.replace(/\D/g, "").length >= 5 ? "Cliente nuevo." : "");
      }
    });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={etiqueta}>
        Cédula / NIT *
        <input
          name="cedula"
          inputMode="numeric"
          required
          onBlur={(e) => buscar(e.target.value)}
          className={campo}
        />
        <span className="mt-1 block text-xs font-normal text-slate-500">{buscando ? "Buscando cliente..." : aviso}</span>
      </label>
      <label className={etiqueta}>
        Nombre completo *
        <input name="nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} />
      </label>
      <label className={etiqueta}>
        Celular (WhatsApp) *
        <input
          name="celular"
          inputMode="numeric"
          required
          value={celular}
          onChange={(e) => setCelular(e.target.value)}
          className={campo}
        />
      </label>
      <label className={etiqueta}>
        Correo
        <input name="correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} className={campo} />
      </label>
    </div>
  );
}

/** Empresa a la que se carga el registro; solo se muestra si el usuario trabaja en varias. */
export function CampoEmpresa({
  empresas,
  valor,
  alCambiar,
}: {
  empresas: { id: string; nombre: string }[];
  valor: string;
  alCambiar: (id: string) => void;
}) {
  if (empresas.length < 2) return <input type="hidden" name="empresa_id" value={valor} />;
  return (
    <label className={etiqueta}>
      Empresa *
      <select
        name="empresa_id"
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        className={`${campo} font-semibold`}
      >
        {empresas.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
