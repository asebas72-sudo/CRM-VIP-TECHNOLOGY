"use client";

import {
  ArrowLeftRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CalendarPlus,
  ChevronRight,
  ClipboardPlus,
  House,
  MailCheck,
  MessageCircle,
  Package,
  QrCode,
  Receipt,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Truck,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Modulo, Rol } from "@/lib/empresa";

type Enlace = { href: string; texto: string; icono: LucideIcon; roles: Rol[]; soloAccesoTotal?: boolean };
type Opcion = Enlace | { texto: string; icono: LucideIcon; hijos: Enlace[] };

const TODOS: Rol[] = ["admin", "bodega", "vendedor", "tecnico"];

const MENUS: Record<Modulo, { titulo: string; opciones: Opcion[] }> = {
  ventas: {
    titulo: "Ventas e inventario",
    opciones: [
      { href: "/tablero", texto: "Inicio", icono: House, roles: ["admin", "bodega", "vendedor"] },
      { href: "/ventas", texto: "Vender", icono: ShoppingCart, roles: ["admin", "vendedor"] },
      { href: "/cartera", texto: "Cartera y abonos", icono: Wallet, roles: ["admin", "vendedor"] },
      { href: "/productos", texto: "Productos", icono: Package, roles: ["admin", "bodega", "vendedor"] },
      { href: "/compras", texto: "Compras", icono: Truck, roles: ["admin", "bodega"] },
      { href: "/facturas-compra", texto: "Facturas compras", icono: MailCheck, roles: TODOS, soloAccesoTotal: true },
      { href: "/etiquetas", texto: "Etiquetas QR", icono: QrCode, roles: ["admin", "bodega"] },
      { href: "/mis-servicios", texto: "Servicios", icono: BriefcaseBusiness, roles: ["admin"] },
      { href: "/portafolio", texto: "Portafolio", icono: Store, roles: ["admin"] },
      { href: "/informes", texto: "Informes", icono: BarChart3, roles: ["admin"] },
      {
        texto: "Configuración",
        icono: Settings,
        hijos: [
          { href: "/configuracion", texto: "Empresa y tirilla", icono: Receipt, roles: ["admin"] },
          { href: "/usuarios", texto: "Usuarios", icono: Users, roles: TODOS, soloAccesoTotal: true },
          { href: "/empresas", texto: "Empresas", icono: Building2, roles: TODOS, soloAccesoTotal: true },
        ],
      },
    ],
  },
  servicio: {
    titulo: "Reparaciones y asesorías",
    opciones: [
      { href: "/servicio", texto: "Órdenes de servicio", icono: Wrench, roles: ["admin", "vendedor", "tecnico"] },
      { href: "/servicio/ingreso", texto: "Nuevo ingreso", icono: ClipboardPlus, roles: ["admin", "vendedor", "tecnico"] },
      { href: "/servicio/asesorias", texto: "Asesorías", icono: CalendarClock, roles: ["admin", "vendedor", "tecnico"] },
      { href: "/servicio/asesorias/nueva", texto: "Nueva asesoría", icono: CalendarPlus, roles: ["admin", "vendedor", "tecnico"] },
      {
        texto: "Configuración",
        icono: Settings,
        hijos: [
          { href: "/servicio/configuracion", texto: "Servicio técnico", icono: SlidersHorizontal, roles: ["admin"] },
          { href: "/servicio/configuracion/mensajes", texto: "Mensajes de WhatsApp", icono: MessageCircle, roles: ["admin"] },
          { href: "/servicio/configuracion/usuarios", texto: "Usuarios", icono: Users, roles: TODOS, soloAccesoTotal: true },
          { href: "/servicio/configuracion/empresas", texto: "Empresas", icono: Building2, roles: TODOS, soloAccesoTotal: true },
        ],
      },
    ],
  },
};

// Cada opción separada por una línea tenue
const separador = "md:border-b md:border-slate-800 md:last:border-b-0";

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

  const enlace = (o: Enlace, hijo = false) => {
    const Icono = o.icono;
    const activo = o.href === resaltada;
    return (
      <Link
        key={o.href}
        href={o.href}
        className={`flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm md:whitespace-normal ${hijo ? "md:pl-8" : ""} ${
          activo ? "bg-slate-800 font-semibold text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}
      >
        <Icono className={`size-[18px] shrink-0 ${activo ? "text-sky-300" : "text-slate-400"}`} strokeWidth={1.8} aria-hidden />
        {o.texto}
      </Link>
    );
  };

  return (
    <nav className="sin-barra flex gap-1 overflow-x-auto md:flex-col md:gap-0 md:overflow-x-hidden">
      {menu && (
        <p className="hidden px-3 pt-1 pb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase md:block">{menu.titulo}</p>
      )}
      {menu?.opciones.map((o) => {
        if (!("hijos" in o)) {
          return permitido(o) ? (
            <div key={o.href} className={`py-0.5 ${separador}`}>
              {enlace(o)}
            </div>
          ) : null;
        }
        const hijos = o.hijos.filter(permitido);
        if (hijos.length === 0) return null;
        return (
          <div key={o.texto} className={`py-0.5 ${separador}`}>
            <Submenu titulo={o.texto} icono={o.icono} abiertoInicial={hijos.some((h) => h.href === resaltada)}>
              {hijos.map((h) => enlace(h, true))}
            </Submenu>
          </div>
        );
      })}
      {modulos.length > 1 && (
        <Link
          href="/"
          className="mt-1 flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm text-amber-300 hover:bg-slate-800 md:mt-3 md:border-t md:border-slate-700 md:pt-3"
        >
          <ArrowLeftRight className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden />
          Cambiar de módulo
        </Link>
      )}
    </nav>
  );
}

function Submenu({
  titulo,
  icono: Icono,
  abiertoInicial,
  children,
}: {
  titulo: string;
  icono: LucideIcon;
  abiertoInicial: boolean;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  return (
    <div className="flex gap-1 md:flex-col md:gap-0">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        className="flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm text-slate-300 md:whitespace-normal hover:bg-slate-800 hover:text-white"
      >
        <Icono className="size-[18px] shrink-0 text-slate-400" strokeWidth={1.8} aria-hidden />
        <span className="flex-1">{titulo}</span>
        <ChevronRight className={`size-4 text-slate-500 transition ${abierto ? "rotate-90" : ""}`} aria-hidden />
      </button>
      {abierto && children}
    </div>
  );
}
