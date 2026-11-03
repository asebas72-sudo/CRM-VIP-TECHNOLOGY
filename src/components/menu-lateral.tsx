"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Modulo, Rol } from "@/lib/empresa";

type Opcion = { href: string; texto: string; roles: Rol[] };

const MENUS: Record<Modulo, { titulo: string; opciones: Opcion[] }> = {
  ventas: {
    titulo: "Ventas e inventario",
    opciones: [
      { href: "/tablero", texto: "Inicio", roles: ["admin", "bodega", "vendedor"] },
      { href: "/ventas", texto: "Vender", roles: ["admin", "vendedor"] },
      { href: "/cartera", texto: "Cartera y abonos", roles: ["admin", "vendedor"] },
      { href: "/productos", texto: "Productos", roles: ["admin", "bodega", "vendedor"] },
      { href: "/compras", texto: "Compras", roles: ["admin", "bodega"] },
      { href: "/etiquetas", texto: "Etiquetas QR", roles: ["admin", "bodega"] },
      { href: "/informes", texto: "Informes", roles: ["admin"] },
    ],
  },
  servicio: {
    titulo: "Reparaciones y asesorías",
    opciones: [
      { href: "/servicio", texto: "Órdenes de servicio", roles: ["admin", "vendedor", "tecnico"] },
      { href: "/servicio/ingreso", texto: "Nuevo ingreso", roles: ["admin", "vendedor", "tecnico"] },
      { href: "/servicio/asesorias", texto: "Asesorías", roles: ["admin", "vendedor", "tecnico"] },
      { href: "/servicio/asesorias/nueva", texto: "Nueva asesoría", roles: ["admin", "vendedor", "tecnico"] },
    ],
  },
};

const COMUNES: Opcion[] = [
  { href: "/usuarios", texto: "Usuarios", roles: ["admin"] },
  { href: "/configuracion", texto: "Configuración", roles: ["admin"] },
];

/** Menú del módulo en el que está el usuario (ventas o servicio técnico). */
export function MenuLateral({ rol, modulos, accesoTotal }: { rol: Rol; modulos: Modulo[]; accesoTotal: boolean }) {
  const ruta = usePathname();
  const actual: Modulo | null = ruta.startsWith("/servicio") ? "servicio" : ruta === "/" ? null : "ventas";
  const menu = actual && modulos.includes(actual) ? MENUS[actual] : null;

  // Opción resaltada: la de ruta más larga que coincide (ej. /servicio/asesorias/nueva gana a /servicio/asesorias)
  const visibles = [...(menu?.opciones ?? []), ...COMUNES, { href: "/empresas", texto: "", roles: [] }];
  const resaltada = visibles
    .filter((o) => ruta === o.href || ruta.startsWith(`${o.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const enlace = (o: { href: string; texto: string }) => {
    const activo = o.href === resaltada;
    return (
      <Link
        key={o.href}
        href={o.href}
        className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${activo ? "bg-slate-800 font-semibold text-white" : "hover:bg-slate-800"}`}
      >
        {o.texto}
      </Link>
    );
  };

  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {menu && (
        <p className="hidden px-3 pt-1 pb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase md:block">{menu.titulo}</p>
      )}
      {menu?.opciones.filter((o) => o.roles.includes(rol)).map(enlace)}
      {menu && <div className="my-2 hidden border-t border-slate-800 md:block" />}
      {COMUNES.filter((o) => o.roles.includes(rol)).map(enlace)}
      {accesoTotal && enlace({ href: "/empresas", texto: "Empresas" })}
      {modulos.length > 1 && (
        <Link href="/" className="mt-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-amber-300 hover:bg-slate-800">
          ⇄ Cambiar de módulo
        </Link>
      )}
    </nav>
  );
}
