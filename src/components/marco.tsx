"use client";

import { PanelLeftClose, Pin } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

/**
 * Estructura de la aplicación según la pantalla:
 * - "/" (¿Qué vas a hacer?): solo el contenido, sin menú ni barra.
 * - Reparaciones: menú lateral sin la barra de empresa (cada formulario
 *   y listado maneja su propia empresa).
 * - Ventas: menú lateral y barra superior con la empresa activa.
 *
 * En computador el menú lateral se esconde para aprovechar la pantalla:
 * queda una franja a la izquierda y aparece al pasar el mouse. Con el
 * botón "Fijar menú" se queda abierto. En celular se ve arriba, como antes.
 */
export function Marco({ menu, barra, children }: { menu: ReactNode; barra: ReactNode; children: ReactNode }) {
  const ruta = usePathname();
  const [fijo, setFijo] = useState(false);

  if (ruta === "/") {
    return <main className="min-h-screen bg-slate-100 p-4 md:p-8">{children}</main>;
  }

  const botonFijar = (
    <button
      type="button"
      onClick={() => setFijo(!fijo)}
      title={fijo ? "Ocultar el menú automáticamente" : "Dejar el menú siempre visible"}
      className="hidden w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs text-slate-400 hover:bg-slate-800 hover:text-white md:flex"
    >
      {fijo ? <PanelLeftClose className="size-4" aria-hidden /> : <Pin className="size-4" aria-hidden />}
      {fijo ? "Ocultar menú" : "Fijar menú"}
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 md:flex-row print:block print:bg-white">
      {fijo ? (
        <div className="barra-menu flex flex-col bg-slate-900 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:overflow-x-hidden md:overflow-y-auto print:hidden [&>aside]:flex-1">
          {menu}
          <div className="px-4 pb-4">{botonFijar}</div>
        </div>
      ) : (
        <>
          {/* Celular: menú arriba como siempre */}
          <div className="md:hidden print:hidden">{menu}</div>
          {/* Computador: franja a la izquierda; el menú se desliza encima del contenido al pasar el mouse */}
          {/* Se abre con el mouse encima (o con Tab del teclado) y se cierra apenas sale el mouse */}
          <div className="group/menu fixed inset-y-0 left-0 z-40 hidden w-60 -translate-x-[calc(100%-10px)] transition-transform duration-200 ease-out hover:translate-x-0 has-[:focus-visible]:translate-x-0 md:block print:hidden">
            <div className="barra-menu flex h-full flex-col overflow-x-hidden overflow-y-auto bg-slate-900 shadow-2xl [&>aside]:flex-1">
              {menu}
              <div className="px-4 pb-4">{botonFijar}</div>
            </div>
            {/* Franja visible cuando está escondido */}
            <div className="pointer-events-none absolute inset-y-0 right-0 flex w-[10px] items-center justify-center bg-slate-900 transition-opacity group-hover/menu:opacity-0">
              <span className="text-[10px] text-slate-400">›</span>
            </div>
          </div>
        </>
      )}
      <div className="min-w-0 flex-1 md:pl-[10px] print:pl-0">
        {/* Reparaciones e Informes manejan varias empresas a la vez: sin barra de empresa */}
        {!ruta.startsWith("/servicio") && !ruta.startsWith("/informes") && barra}
        <main className="p-4 md:p-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
