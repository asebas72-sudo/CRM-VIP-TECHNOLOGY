"use client";

import { usePathname } from "next/navigation";
import { cambiarEmpresa } from "@/app/(app)/acciones";

/**
 * Barra superior con la empresa activa. Al cambiarla se queda en la misma
 * sección (por ejemplo Productos) pero con los datos de la otra empresa.
 */
export function SelectorEmpresa({
  empresas,
  activa,
}: {
  empresas: { id: string; nombre: string }[];
  activa: string;
}) {
  const ruta = usePathname();
  const seccion = "/" + (ruta.split("/")[1] ?? "");

  return (
    <form action={cambiarEmpresa} className="flex items-center gap-2">
      <input type="hidden" name="volver" value={seccion} />
      <label htmlFor="empresa-activa" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Empresa
      </label>
      {empresas.length > 1 ? (
        <select
          id="empresa-activa"
          name="empresa_id"
          defaultValue={activa}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="rounded-lg border border-slate-300 bg-white py-1.5 pr-8 pl-3 font-semibold text-slate-900"
        >
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
      ) : (
        <span id="empresa-activa" className="font-semibold text-slate-900">
          {empresas[0]?.nombre}
        </span>
      )}
    </form>
  );
}
