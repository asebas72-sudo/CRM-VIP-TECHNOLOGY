"use client";

import { useState } from "react";
import { DEPARTAMENTOS, NOMBRES_DEPARTAMENTOS } from "@/lib/colombia";

/**
 * Departamento + municipio de Colombia desde la lista oficial (DIVIPOLA),
 * para evitar errores de digitación. Envía los campos `departamento` y `ciudad`.
 */
export function SelectorUbicacion({
  departamento,
  ciudad,
  claseCampo,
  claseEtiqueta,
  alCambiar,
}: {
  departamento?: string | null;
  ciudad?: string | null;
  claseCampo: string;
  claseEtiqueta?: string;
  alCambiar?: (v: { departamento: string; ciudad: string }) => void;
}) {
  const [depto, setDepto] = useState(departamento && DEPARTAMENTOS[departamento] ? departamento : "");
  const [muni, setMuni] = useState(ciudad ?? "");
  const municipios = depto ? DEPARTAMENTOS[depto] : [];

  return (
    <>
      <label className={claseEtiqueta}>
        Departamento
        <select
          name="departamento"
          value={depto}
          onChange={(e) => {
            setDepto(e.target.value);
            setMuni("");
            alCambiar?.({ departamento: e.target.value, ciudad: "" });
          }}
          className={claseCampo}
        >
          <option value="">Seleccione...</option>
          {NOMBRES_DEPARTAMENTOS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <label className={claseEtiqueta}>
        Ciudad / municipio
        <select
          name="ciudad"
          value={municipios.includes(muni) ? muni : ""}
          disabled={!depto}
          onChange={(e) => {
            setMuni(e.target.value);
            alCambiar?.({ departamento: depto, ciudad: e.target.value });
          }}
          className={claseCampo}
        >
          <option value="">{depto ? "Seleccione..." : "Elija primero el departamento"}</option>
          {municipios.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
