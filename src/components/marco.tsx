"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Estructura de la aplicación según la pantalla:
 * - "/" (¿Qué vas a hacer?): solo el contenido, sin menú ni barra.
 * - Reparaciones: menú lateral sin la barra de empresa (cada formulario
 *   y listado maneja su propia empresa).
 * - Ventas: menú lateral y barra superior con la empresa activa.
 */
export function Marco({ menu, barra, children }: { menu: ReactNode; barra: ReactNode; children: ReactNode }) {
  const ruta = usePathname();

  if (ruta === "/") {
    return <main className="min-h-screen bg-slate-100 p-4 md:p-8">{children}</main>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 md:flex-row print:block print:bg-white">
      {menu}
      <div className="min-w-0 flex-1">
        {/* Reparaciones e Informes manejan varias empresas a la vez: sin barra de empresa */}
        {!ruta.startsWith("/servicio") && !ruta.startsWith("/informes") && barra}
        <main className="p-4 md:p-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
