"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Modulo, Rol } from "@/lib/empresa";

type Enlace = { href: string; texto: string; roles: Rol[]; soloAccesoTotal?: boolean };
type Opcion = Enlace | { texto: string; icono: string; hijos: Enlace[] };

const TODOS: Rol[] = ["admin", "bodega", "vendedor", "tecnico"];

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
      {
        texto: "Configuración",
        icono: "⚙️",
        hijos: [
          { href: "/configuracion", texto: "Empresa y tirilla", roles: ["admin"] },
          { href: "/usuarios", texto: "Usuarios", roles: TODOS, soloAccesoTotal: true },
          { href: "/empresas", texto: "Empresas", roles: TODOS, soloAccesoTotal: true },
        ],
      },
    ],
  },
  servicio: {
    titulo: "Reparaciones y asesorías",
    opciones: [
      { href: "/servicio", texto: "Órdenes de servicio", roles: ["admin", "vendedor", "tecnico"] },
      { href: "/servicio/ingreso", texto: "Nuevo ingreso", roles: ["admin", "vendedor", "tecnico"] },
      { href: "/servicio/asesorias", texto: "Asesorías", roles: ["admin", "vendedor", "tecnico"] },
      { href: "/servicio/asesorias/nueva", texto: "Nueva asesoría", roles: ["admin", "vendedor", "tecnico"] },
      {
        texto: "Configuración",
        icono: "⚙️",
        hijos: [
          { href: "/servicio/configuracion", texto: "Servicio técnico", roles: ["admin"] },
          { href: "/servicio/configuracion/mensajes", texto: "Mensajes de WhatsApp", roles: ["admin"] },
          { href: "/servicio/configuracion/usuarios", texto: "Usuarios", roles: TODOS, soloAccesoTotal: true },
          { href: "/servicio/configuracion/empresas", texto: "Empresas", roles: TODOS, soloAccesoTotal: true },
        ],
      },
    ],
  },
};

/** Menú del módulo en el que está el usuario (ventas o servicio técnico). */
export function MenuLateral({ rol, modulos, accesoTotal }: { rol: Rol; modulos: Modulo[]; accesoTotal: boolean }) {
  const ruta = usePathname();
  const actual: Modulo | null = ruta.startsWith("/servicio") ? "servicio" : ruta === "/" ? null : "ventas";
  const menu = actual && modulos.includes(actual) ? MENUS[actual] : null;

  const permitido = (e: Enlace) => e.roles.includes(rol) && (!e.soloAccesoTotal || accesoTotal);
  const enlaces = (menu?.opciones ?? []).flatMap((o) => ("hijos" in o ? o.hijos : [o])).filter(permitido);

  // Opción resaltada: la de ruta más larga que coincide (ej. /servicio/asesorias/nueva gana a /servicio/asesorias)
  const resaltada = enlaces
    .filter((o) => ruta === o.href || ruta.startsWith(`${o.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const enlace = (o: Enlace, hijo = false) => (
    <Link
      key={o.href}
      href={o.href}
      className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${hijo ? "md:pl-9" : ""} ${
        o.href === resaltada ? "bg-slate-800 font-semibold text-white" : "text-slate-200 hover:bg-slate-800"
      }`}
    >
      {o.texto}
    </Link>
  );

  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {menu && (
        <p className="hidden px-3 pt-1 pb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase md:block">{menu.titulo}</p>
      )}
      {menu?.opciones.map((o) => {
        if (!("hijos" in o)) return permitido(o) ? enlace(o) : null;
        const hijos = o.hijos.filter(permitido);
        if (hijos.length === 0) return null;
        return (
          <Submenu
            key={o.texto}
            titulo={o.texto}
            icono={o.icono}
            abiertoInicial={hijos.some((h) => h.href === resaltada)}
          >
            {hijos.map((h) => enlace(h, true))}
          </Submenu>
        );
      })}
      {modulos.length > 1 && (
        <Link
          href="/"
          className="mt-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-amber-300 hover:bg-slate-800 md:mt-3 md:border-t md:border-slate-800 md:pt-3"
        >
          ⇄ Cambiar de módulo
        </Link>
      )}
    </nav>
  );
}

function Submenu({
  titulo,
  icono,
  abiertoInicial,
  children,
}: {
  titulo: string;
  icono: string;
  abiertoInicial: boolean;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  return (
    <div className="flex gap-1 md:flex-col">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        className="flex items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
      >
        <span>
          {icono} {titulo}
        </span>
        <span className={`text-xs text-slate-400 transition ${abierto ? "rotate-90" : ""}`}>▶</span>
      </button>
      {abierto && children}
    </div>
  );
}
