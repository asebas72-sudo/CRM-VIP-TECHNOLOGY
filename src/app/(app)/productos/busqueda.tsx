"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useTransition, type FormEvent, type ReactNode } from "react";

const ESPERA_MS = 300;

/**
 * Formulario que aplica la búsqueda mientras se escribe, sin botón "Buscar".
 * Enter (el lector de códigos lo envía) y los filtros se aplican de inmediato.
 */
export function FormularioBusqueda({ children }: { children: ReactNode }) {
  const router = useRouter();
  const ruta = usePathname();
  const [buscando, iniciar] = useTransition();
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  function aplicar(form: HTMLFormElement) {
    clearTimeout(temporizador.current);
    const parametros = new URLSearchParams();
    for (const [clave, valor] of new FormData(form)) {
      if (typeof valor === "string" && valor.trim()) parametros.set(clave, valor.trim());
    }
    const consulta = parametros.toString();
    iniciar(() => router.replace(consulta ? `${ruta}?${consulta}` : ruta, { scroll: false }));
  }

  function alCambiar(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    if (e.target instanceof HTMLSelectElement) {
      aplicar(form);
      return;
    }
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => aplicar(form), ESPERA_MS);
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onChange={alCambiar}
      onSubmit={(e) => {
        e.preventDefault();
        aplicar(e.currentTarget);
      }}
      aria-busy={buscando}
    >
      {children}
      <span className={`text-sm text-slate-500 ${buscando ? "" : "invisible"}`} aria-live="polite">
        Buscando…
      </span>
    </form>
  );
}
